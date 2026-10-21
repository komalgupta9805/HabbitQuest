import React from 'react';

/** Spark is an original leaf-winged owl drawn entirely in SVG. */
export default function Owl({ className = '', mood = 'happy' }) {
  return <svg className={`hq-owl ${className}`} viewBox="0 0 180 190" role="img" aria-label="Spark the green owl" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="91" cy="177" rx="53" ry="7" fill="#314e2e" opacity=".12" />
    <path d="M48 47 35 19l32 13c15-7 32-7 47 0l31-13-12 29c15 14 21 33 18 55-4 36-29 63-60 63s-57-27-61-63c-3-22 3-41 18-56Z" fill="#73c72c" stroke="#399e25" strokeWidth="4" strokeLinejoin="round" />
    <path d="M55 43c20-17 52-18 73 0-14-5-23 4-37 7-17 4-26-8-36-7Z" fill="#9be43d" />
    <path d="M37 90C10 69 9 125 47 135" fill="#4eaf25" stroke="#328f24" strokeWidth="3" />
    <path d="M143 90c28-21 31 35-8 45" fill="#4eaf25" stroke="#328f24" strokeWidth="3" />
    <ellipse cx="66" cy="83" rx="26" ry="34" fill="#fffdf2" /><ellipse cx="114" cy="83" rx="26" ry="34" fill="#fffdf2" />
    <ellipse cx="69" cy="85" rx="11" ry="17" fill="#204d43" /><ellipse cx="111" cy="85" rx="11" ry="17" fill="#204d43" />
    <circle cx="73" cy="78" r="4" fill="white" /><circle cx="115" cy="78" r="4" fill="white" />
    <path d="m79 111 11 11 11-11c-7-8-15-8-22 0Z" fill="#f4a01e" stroke="#dc7d16" strokeWidth="2" />
    {mood === 'party' ? <path d="M80 131q10 13 21 0" fill="none" stroke="#285b40" strokeWidth="4" strokeLinecap="round" /> : <path d="M83 133q8 7 16 0" fill="none" stroke="#285b40" strokeWidth="3" strokeLinecap="round" />}
    <path d="M67 162c-5 11-15 14-24 8m69-8c5 11 15 14 24 8" fill="none" stroke="#e99317" strokeWidth="8" strokeLinecap="round" />
    <path d="M48 35c-6-11-10-21-11-29 14 6 23 12 29 21m66 8c7-11 10-21 11-29-14 6-23 12-29 21" fill="#58b729" stroke="#339e25" strokeWidth="3" strokeLinejoin="round" />
  </svg>;
}

export function LeafLogo() {
  return <svg viewBox="0 0 32 32" aria-hidden="true" fill="none"><path d="M24 4C11 6 5 14 8 23c7 6 19 0 17-14l-1-5Z" fill="#7ccf43" /><path d="M9 25c4-6 9-11 15-16" stroke="#20583b" strokeWidth="2.5" strokeLinecap="round" /><path d="M15 18c-1-4-3-6-6-7m8 5c4 0 6-1 9-4" stroke="#20583b" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
