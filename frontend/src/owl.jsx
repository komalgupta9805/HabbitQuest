import React from 'react';

/** Questie is an original rounded green companion drawn as a lightweight SVG. */
export default function Owl({ className = '', mood = 'happy' }) {
  const calm = mood === 'calm'; const party = mood === 'party';
  return <svg className={`hq-owl ${className}`} viewBox="0 0 180 190" role="img" aria-label={`Questie the green mascot feeling ${mood}`} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="90" cy="174" rx="55" ry="7" fill="#274932" opacity=".14" />
    {party && <g aria-hidden="true"><rect x="24" y="25" width="9" height="9" rx="2" fill="#ffb32e" transform="rotate(22 24 25)" /><rect x="145" y="35" width="8" height="8" rx="2" fill="#70c9ef" transform="rotate(-18 145 35)" /><path d="M38 45 29 35" stroke="#f47a91" strokeWidth="6" strokeLinecap="round" /><path d="m139 21 7-12" stroke="#735dd0" strokeWidth="6" strokeLinecap="round" /></g>}
    <path d="M49 43c7-13 20-18 33-12 5 2 11 2 16 0 14-6 28-1 34 12 8 18 10 40 8 67-2 35-20 56-50 56s-49-21-51-56c-2-27 1-49 10-67Z" fill="#69cf00" />
    <path d="M51 47c12-12 23-13 34-7 4 2 8 2 12 0 12-6 23-5 34 7l-9 13c-19-9-43-9-62 0L51 47Z" fill="#8bea00" />
    <path d="M43 76C16 68 16 96 42 113l12-13-11-24Zm94 0c27-8 27 20 1 37l-12-13 11-24Z" fill="#5bbc00" />
    <ellipse cx="67" cy="83" rx="25" ry="30" fill="#fff" /><ellipse cx="113" cy="83" rx="25" ry="30" fill="#fff" />
    {calm ? <g><path d="M50 84q17 10 34 0" fill="none" stroke="#38534d" strokeWidth="6" strokeLinecap="round" /><path d="M96 84q17 10 34 0" fill="none" stroke="#38534d" strokeWidth="6" strokeLinecap="round" /></g> : <g><ellipse cx="70" cy="84" rx="10" ry="16" fill="#354a47" /><ellipse cx="110" cy="84" rx="10" ry="16" fill="#354a47" /><circle cx="74" cy="78" r="4" fill="#fff" /><circle cx="114" cy="78" r="4" fill="#fff" /></g>}
    <path d="M78 105c7-7 17-7 24 0-2 11-7 16-12 16s-10-5-12-16Z" fill="#ff9d00" /><path d="M82 108h16" stroke="#e27800" strokeWidth="2" strokeLinecap="round" />
    <path d="M82 126q8 7 16 0" fill="none" stroke="#315149" strokeWidth="3" strokeLinecap="round" />
    <path d="M72 162c-5 9-14 10-23 5m59-5c5 9 14 10 23 5" fill="none" stroke="#ff9700" strokeWidth="9" strokeLinecap="round" />
  </svg>;
}

export function LeafLogo() {
  return <svg viewBox="0 0 32 32" aria-hidden="true" fill="none"><path d="M24 4C11 6 5 14 8 23c7 6 19 0 17-14l-1-5Z" fill="#7ccf43" /><path d="M9 25c4-6 9-11 15-16" stroke="#20583b" strokeWidth="2.5" strokeLinecap="round" /><path d="M15 18c-1-4-3-6-6-7m8 5c4 0 6-1 9-4" stroke="#20583b" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
