// Original generated illustrations, prepared as local offline assets; see art/README.md.
const resources=new Set(['brick','wood','grain','wool','ore']);
export function symbol(resource){if(!resources.has(resource))return '';return `<svg viewBox="0 0 144 144" aria-hidden="true" class="resource-icon illustrated-resource ${resource}"><image href="./art/resource-${resource}.webp" width="144" height="144"/></svg>`;}
