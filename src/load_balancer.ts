// src/load_balancer.ts
// 加权负载均衡器与主备容灾切换（管理同一模型下的多个 EndpointManager）

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

    /** 按照权重从大到小（主备优先顺序）返回所有可用端点列表，实现真正的 Failover 链式容灾 */
    async getAvailableEndpointsOrdered(): Promise<EndpointManager[]> {
        return this.mutex.run(async () => {
            const available: EndpointManager[] = [];
            for (const endpoint of this.endpoints) {
                if (await endpoint.hasAvailableKey()) {
                    available.push(endpoint);
                }
            }
            // 权重相同时严格保持 YAML 配置中的声明先后顺序 (Stable Index Order)
            return available.sort((a, b) => {
                const diff = b.getWeight() - a.getWeight();
                if (diff !== 0) return diff;
                return this.endpoints.indexOf(a) - this.endpoints.indexOf(b);
            });
        });
    }

    /** 按权重获取一个当前有可用 Key 的端点 */
    async getAvailableEndpoint(): Promise<EndpointManager | null> {
        const ordered = await this.getAvailableEndpointsOrdered();
        return ordered.length > 0 ? ordered[0] : null;
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
