/**
 * Domain Registry Service
 *
 * Maintains an in-memory registry of all deployed dynamic domains.
 * Loaded from database on startup and updated when new domains are deployed.
 */

import { getDeployedDomains, type DeployedDomain } from './dynamicSchema.js';

// In-memory registry of deployed domains
const domainRegistry = new Map<string, DeployedDomain>();

/**
 * Load all deployed domains from database into memory
 * Should be called on server startup
 */
export function loadDomainsFromDB(): void {
  domainRegistry.clear();

  try {
    const domains = getDeployedDomains();
    for (const domain of domains) {
      domainRegistry.set(domain.name, domain);
    }
    console.log(`[DomainRegistry] Loaded ${domainRegistry.size} dynamic domains`);
  } catch (error) {
    console.log('[DomainRegistry] No deployed domains found (or table not ready)');
  }
}

/**
 * Register a newly deployed domain
 */
export function registerDomain(domain: DeployedDomain): void {
  domainRegistry.set(domain.name, domain);
  console.log(`[DomainRegistry] Registered domain "${domain.name}"`);
}

/**
 * Get a domain by name
 */
export function getDomain(name: string): DeployedDomain | undefined {
  return domainRegistry.get(name);
}

/**
 * Get all registered domains
 */
export function getAllDomains(): DeployedDomain[] {
  return Array.from(domainRegistry.values());
}

/**
 * Check if a domain exists
 */
export function hasDomain(name: string): boolean {
  return domainRegistry.has(name);
}

/**
 * Get list of domain names
 */
export function getDomainNames(): string[] {
  return Array.from(domainRegistry.keys());
}

/**
 * Get the total count of registered domains
 */
export function getDomainCount(): number {
  return domainRegistry.size;
}

/**
 * Clear the registry (for testing)
 */
export function clearRegistry(): void {
  domainRegistry.clear();
}
