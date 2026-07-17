// src/load_balancer.ts
// 加权负载均衡器（管理同一模型下的多个 EndpointManager）

import { EndpointManager } from "./endpoint_manager.ts";
import { Mutex } from "./mutex.ts";

export class WeightedLoadBalancer {
    private endpoints: EndpointManager[] = [];
    private totalWeight = 0;
    private mutex = new Mutex();

    constructor(endpoints: EndpointManager[]) {
        this.endpoints = endpoints;
        this.totalWeight = endpoints.reduce((sum, e) => sum + e.getWeight(), 0);
    }

    /** 按权重获取一个当前有可用 Key 的端点 */
    async getAvailableEndpoint(): Promise<EndpointManager | null> {
        return this.mutex.run(async () => {
            if (this.endpoints.length === 0 || this.totalWeight === 0) {
                return null;
            }

            const available: EndpointManager[] = [];
            for (const endpoint of this.endpoints) {
                if (await endpoint.hasAvailableKey()) {
                    available.push(endpoint);
                }
            }

            if (available.length === 0) return null;
            if (available.length === 1) return available[0];

            const totalWeight = available.reduce((sum, e) => sum + e.getWeight(), 0);
            let rand = Math.random() * totalWeight;
            for (const endpoint of available) {
                rand -= endpoint.getWeight();
                if (rand <= 0) return endpoint;
            }
            return available[available.length - 1];
        });
    }

    async removeEndpoint(manager: EndpointManager): Promise<void> {
        await this.mutex.run(() => {
            const index = this.endpoints.indexOf(manager);
            if (index !== -1) {
                this.endpoints.splice(index, 1);
                this.totalWeight = this.endpoints.reduce((sum, e) => sum + e.getWeight(), 0);
            }
        });
    }

    async addEndpoint(manager: EndpointManager): Promise<void> {
        await this.mutex.run(() => {
            this.endpoints.push(manager);
            this.totalWeight += manager.getWeight();
        });
    }

    getEndpoints(): EndpointManager[] {
        return this.endpoints;
    }
}
