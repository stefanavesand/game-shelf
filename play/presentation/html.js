// Presentation primitives accept text, never game commands or transport objects.
export const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const button=(label,action,classes='',disabled=false)=>`<button type="button" data-action="${action}" class="${classes}" ${disabled?'disabled':''}>${label}</button>`;
