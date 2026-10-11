// Every block in the timetable belongs to one pillar. Colours drive the 3D scene,
// the day dial, the timeline and the weekly hours chart.
export const PILLARS = {
  career:  { key: 'career',  label: 'Career',        color: '#4cc9f0', icon: '◆' },
  fiverr:  { key: 'fiverr',  label: 'Fiverr',        color: '#1dbf73', icon: '▲' },
  content: { key: 'content', label: 'Content A·B·C·D', color: '#ff4fd8', icon: '●' },
  wealth:  { key: 'wealth',  label: 'Wealth research', color: '#ffc857', icon: '■' },
  body:    { key: 'body',    label: 'Body',          color: '#ff6b6b', icon: '✚' },
  mind:    { key: 'mind',    label: 'Prayer & mind', color: '#b388ff', icon: '✦' },
  office:  { key: 'office',  label: 'Office',        color: '#3a86ff', icon: '▣' },
  commute: { key: 'commute', label: 'Commute',       color: '#7d8bb0', icon: '→' },
  life:    { key: 'life',    label: 'Family & meals', color: '#f4a261', icon: '♥' },
  sleep:   { key: 'sleep',   label: 'Sleep',         color: '#2e3358', icon: '☾' },
}

// The four goals the whole system exists to serve (shown as planets in 3D).
export const CORE_FOUR = ['career', 'fiverr', 'content', 'wealth']
