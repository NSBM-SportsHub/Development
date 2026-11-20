// Shared vector artwork keeps the logo and animated parrot hats crisp at any size.
export function SantaHatArtwork() {
  return <>
    <path d="M9 38C14 22 24 4 39 5c12 0 17 12 18 23l-9-3c-2-6-5-10-9-9 1 9 5 16 10 23Z" fill="#d93843" />
    <path d="M9 38c6-10 17-24 30-24-9 7-14 15-16 25Z" fill="#ef5557" />
    <path d="M39 16c-1 10 4 18 10 23l-13-1c-3-9-2-16 3-22Z" fill="#ad2635" />
    <path d="M8 35c12-4 29-3 42 1 4 1 5 10 0 12-13-4-29-5-42-1-5 1-6-10 0-12Z" fill="#f6fbff" stroke="#d9e7ed" strokeWidth="1.2" />
    <path d="M10 38c12-3 26-2 38 1" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <path d="M52 22c6-2 11 3 10 8s-7 8-12 4-3-10 2-12Z" fill="#f6fbff" stroke="#d9e7ed" strokeWidth="1.2" />
  </>;
}

export default function SantaHat({ className = '' }) {
  return <svg className={`christmas-hat ${className}`} viewBox="0 0 66 52" fill="none" aria-hidden="true" focusable="false"><SantaHatArtwork /></svg>;
}
