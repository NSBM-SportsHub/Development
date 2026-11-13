import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/AuthContext.jsx';
import { Icon } from '../../shared/ui.jsx';
import { dateLabel } from './event-utils.js';
import { useMotion } from '../../shared/MotionContext.jsx';
import './home-hero.css';

function AthleteArt() {
  return <svg className="home-hero-athlete" viewBox="0 0 460 500" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="hero-jersey" x1="206" y1="143" x2="278" y2="248" gradientUnits="userSpaceOnUse"><stop stopColor="#ecffb3" /><stop offset="1" stopColor="#b4dc55" /></linearGradient>
      <linearGradient id="hero-skin" x1="200" y1="140" x2="306" y2="354" gradientUnits="userSpaceOnUse"><stop stopColor="#bb825f" /><stop offset="1" stopColor="#704b38" /></linearGradient>
      <linearGradient id="hero-shoe" x1="296" y1="342" x2="356" y2="373" gradientUnits="userSpaceOnUse"><stop stopColor="#f1ffbc" /><stop offset="1" stopColor="#bfdc6a" /></linearGradient>
    </defs>
    <g className="hero-track-lines" stroke="#d5ecb2" strokeOpacity=".2" strokeWidth="1.2"><path d="M-80 445 Q190 265 540 356 M-80 470 Q185 290 540 381 M-80 495 Q185 315 540 406 M-80 520 Q185 340 540 431" /><path d="M15 382 130 500 M145 325 280 500 M290 309 430 477" /></g>
    <ellipse cx="235" cy="426" rx="113" ry="13" fill="#071f17" fillOpacity=".38" />
    <g className="hero-runner">
      <path d="M241 250 Q230 283 205 300 L166 318 136 341 122 330 150 301 185 282 212 243Z" fill="url(#hero-skin)" />
      <path d="M238 272 Q258 288 268 307 L300 345 316 338 291 292 Q276 266 260 250Z" fill="url(#hero-skin)" />
      <path d="M123 327 Q129 328 139 338 L139 346 111 358 Q95 364 88 356 L93 348 111 342Z" fill="#eaf4d7" />
      <path d="m92 356 46-16 6 8-41 17Q94 369 86 362Z" fill="#b9d864" />
      <path d="M297 339 Q309 343 316 335 L332 345 356 354 Q363 359 360 366 L333 366 311 357 301 357Z" fill="url(#hero-shoe)" />
      <path d="M304 353 330 360 361 362 363 370 331 373 307 363Z" fill="#eff6dd" />
      <path d="m315 345 10 9m-5-12 12 13m-29 1 8-10" stroke="#6f8e40" strokeWidth="2.2" />
      <path d="M230 156 Q213 164 210 184 L193 200 163 183 153 193 Q169 216 194 220 Q207 220 226 198 L244 176Z" fill="url(#hero-skin)" />
      <path d="m160 185-12-10-6 2 5 10-7-3-3 4 15 10 12-5Z" fill="#bd8764" />
      <path d="M278 155 Q295 163 304 185 L315 207 Q315 216 305 223 L283 235 275 224 294 207 280 188 264 177Z" fill="url(#hero-skin)" />
      <path d="m278 223-9 6-5 12 4 4 6-8 1 8 5-1 6-14Z" fill="#a56f50" />
      <path d="m260 130-6 23 22 12 6-27Z" fill="#986447" />
      <path d="M252 145 Q263 153 281 148 L288 174 272 199 268 239 Q247 256 211 240 L213 204 224 165Z" fill="url(#hero-jersey)" />
      <path d="M225 165 236 159 226 202 228 239 212 237 214 203Z" fill="#e9f6cd" />
      <path d="M273 155 264 171 281 181 288 174 283 153Z" fill="#eaf8d1" />
      <path d="M215 237 Q242 249 269 236 L267 265 253 283 237 275 235 259 217 278 200 267Z" fill="#183b2f" />
      <path d="m215 241-6 21 11 5m43-24-1 19-10 12" stroke="#d4eb91" strokeWidth="2.5" />
      <path d="M253 89 Q271 81 286 95 L290 111 299 119 294 126 288 127 Q286 143 273 146 L255 137 248 117Z" fill="#bc8462" />
      <path d="M251 121 Q240 109 246 94 Q250 80 269 80 Q285 79 290 96 L282 104 272 97 260 102 257 118Z" fill="#18352c" />
      <path d="M255 119 Q247 114 248 124 Q250 131 258 130" fill="#a16b4c" />
      <path d="m280 113 5 1m-6 18 7-1" stroke="#4c3528" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M263 174h11m-10 6h9m-17 12h18" stroke="#305537" strokeWidth="2" strokeLinecap="round" />
      <path d="m240 184-3 16 9-11-2 15" stroke="#305537" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g className="hero-speed-lines" stroke="#dcf3a3" strokeWidth="3" strokeLinecap="round"><path d="M99 238h61m-77 13h53m-16 13h40" /><path d="M310 97h34m-10 13h33" strokeWidth="2" /></g>
  </svg>;
}

export default function HomeHero({ spotlight }) {
  const { user } = useAuth();
  const { paused } = useMotion();
  function tilt(event) {
    if (paused || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--hero-rx', `${(event.clientY - rect.top - rect.height / 2) / rect.height * -6}deg`);
    event.currentTarget.style.setProperty('--hero-ry', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 7}deg`);
  }
  return <section className={`home-hero${paused ? ' motion-paused' : ''}`} aria-labelledby="home-hero-title">
    <div className="home-hero-copy"><span className="discovery-kicker">ONE CAMPUS. EVERY SPORT.</span><h1 id="home-hero-title"><span data-bird-perch>Move your</span><br /><em>game.</em></h1><p className="home-hero-intro">Big match energy. Your kind of people.<br />Find your team and make your next campus moment count.</p><div className="home-hero-actions"><a className="discovery-button" href="#whats-on">Discover activities <Icon name="arrow" /></a><Link className="home-hero-secondary" to="/sports-clubs">Find your club <Icon name="clubs" size={18} /></Link></div><div className="home-hero-shortcuts" aria-label="Explore campus sport"><Link to="/sports-clubs"><Icon name="sport" size={18} /><span>Clubs</span></Link><Link to="/training-attendance"><Icon name="calendar" size={18} /><span>Training</span></Link><Link to="/tournaments"><Icon name="trophy" size={18} /><span>Tournaments</span></Link></div><a className="home-play-link" href="#play-zone"><span aria-hidden="true">↓</span> Take a little play break</a></div>
    <div className="home-hero-visual" onPointerMove={tilt} onPointerLeave={(event) => { event.currentTarget.style.setProperty('--hero-rx', '0deg'); event.currentTarget.style.setProperty('--hero-ry', '0deg'); }}><div className="hero-stadium" aria-hidden="true"><span className="hero-stadium-glow" /><span className="hero-stadium-orbit" /><span className="hero-stadium-type">PLAY<br /><em>TOGETHER.</em></span><span className="hero-stadium-caption">THE CAMPUS IS YOURS.</span><AthleteArt /><span className="hero-team-sticker">BUILT FOR<br /><strong>THE TEAM.</strong><span>↗</span></span><span className="hero-play-badge"><Icon name="sport" size={26} /><small>BRING YOUR GAME</small></span></div><Link className="hero-spotlight" to={spotlight ? `/events/${spotlight.id}` : user ? '/memberships/mine' : '/register'}><span className="hero-spotlight-icon"><Icon name={spotlight ? 'calendar' : 'join'} size={23} /></span><span><small>{spotlight ? 'IN THE SPOTLIGHT' : 'YOUR NEXT CHAPTER'}</small><strong>{spotlight ? spotlight.title : 'Train together. Play together.'}</strong><span>{spotlight ? `${dateLabel(spotlight.starts_at)} · ${spotlight.venue}` : 'A place in the team starts with you.'}</span></span><span className="hero-spotlight-arrow" aria-hidden="true">↗</span></Link></div>
  </section>;
}
