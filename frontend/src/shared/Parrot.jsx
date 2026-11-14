import { useImperativeHandle, useRef } from 'react';

// A jointed vector interpretation of the supplied green-and-yellow parrot.
export default function Parrot({ motionRef }) {
  const nearWing = useRef(null), farWing = useRef(null), tail = useRef(null), foldedWing = useRef(null), feet = useRef(null);
  const body = useRef(null), head = useRef(null), eye = useRef(null), leftFoot = useRef(null), rightFoot = useRef(null);
  useImperativeHandle(motionRef, () => ({
    paint(bird) {
      const beat = Math.sin(bird.phase), fold = bird.perchBlend ?? 0, flap = (1 - bird.glideBlend) * (1 - fold);
      const pose = bird.perchedMotion?.pose;
      const peck = pose?.peck ?? 0, look = pose?.look ?? 0, ruffle = pose?.ruffle ?? 0;
      body.current?.setAttribute('transform', `rotate(${-38 * peck + ruffle * 1.5} 116 158) translate(0 ${-(pose?.breath ?? 0)})`);
      head.current?.setAttribute('transform', `rotate(${look - 65 * peck} 90 100)`);
      eye.current?.setAttribute('transform', `translate(64 67) scale(1 ${1 - (pose?.blink ?? 0) * .96}) translate(-64 -67)`);
      leftFoot.current?.setAttribute('transform', `translate(${(pose?.leftGrip ?? 0) * 2} ${-(pose?.leftGrip ?? 0) * 5}) rotate(${-(pose?.leftGrip ?? 0) * 8} 106 170)`);
      rightFoot.current?.setAttribute('transform', `translate(${-(pose?.rightGrip ?? 0) * 2} ${-(pose?.rightGrip ?? 0) * 5}) rotate(${(pose?.rightGrip ?? 0) * 8} 125 172)`);
      foldedWing.current?.setAttribute('transform', `rotate(${ruffle * 9} 109 113)`);
      nearWing.current?.setAttribute('transform', `translate(113 113) rotate(${beat * 25 * flap + fold * 98}) scale(${1 - fold * .65} ${.8 + beat * .2 * flap - fold * .4}) translate(-113 -113)`);
      farWing.current?.setAttribute('transform', `translate(80 125) rotate(${-Math.sin(bird.phase + .35) * 22 * flap - fold * 87}) scale(${1 - fold * .75} ${.85 - beat * .15 * flap - fold * .6}) translate(-80 -125)`);
      nearWing.current?.setAttribute('opacity', String(1 - fold)); farWing.current?.setAttribute('opacity', String(1 - fold));
      foldedWing.current?.setAttribute('opacity', String(fold)); feet.current?.setAttribute('opacity', String(fold));
      tail.current?.setAttribute('transform', `translate(${fold * 8} 0) rotate(${Math.sin(bird.time * 2.2) * 3 * (1 - fold * .75) + bird.bank * .16 + (pose?.tail ?? 0) + peck * 8} 136 158)`);
    },
  }), []);
  return <svg className="parrot-art" viewBox="-16 -20 280 290" fill="none" aria-hidden="true" focusable="false">
    <g ref={farWing} className="parrot-far-wing">
      <path d="M81 116 C57 128 29 145 20 178 L12 207 Q25 179 36 171 Q27 195 32 216 Q39 191 47 184 Q43 211 52 220 Q53 198 60 189 Q61 208 70 215 Q67 195 73 185 Q80 202 91 204 Q80 187 83 180 Q95 191 106 191 L92 145Z" fill="#f6b918" />
      <path d="M80 114 Q48 129 30 157 Q17 179 12 207 Q29 164 55 155 Q74 146 94 139Z" fill="#368f3d" />
      <path d="M83 124 Q57 139 43 158 Q30 178 24 187 Q40 177 49 169 Q71 151 94 146Z" fill="#83bc39" />
      <path d="M39 177 Q29 200 35 213 Q35 192 43 181 M52 184 Q46 205 54 217 Q53 196 58 187 M66 186 Q63 201 72 211 Q67 196 70 190" fill="#ffd329" />
    </g>
    <g ref={tail} className="parrot-tail">
      <path d="M129 151 Q151 167 204 170 Q179 181 153 173 Q181 188 215 184 Q200 199 169 185 Q187 207 207 222 Q175 225 155 194 Q159 219 174 232 Q141 226 137 184Z" fill="#a6cb40" />
      <path d="M135 158 Q158 174 198 173 Q170 180 145 168 Q171 191 209 188 Q184 197 151 177 Q173 209 201 224 Q173 218 145 185 Q149 214 166 228 Q145 218 138 192Z" fill="#388f3b" />
      <path d="M143 166 Q157 181 181 190 M145 178 Q158 201 178 215" stroke="#71ad35" strokeWidth="4" strokeLinecap="round" />
    </g>
    <g ref={body} className="parrot-body">
    <path d="M70 90 Q90 80 105 86 Q109 89 126 97 Q147 110 151 140 Q151 152 156 164 Q141 172 116 162 Q88 150 79 129 Q71 112 68 91Z" fill="#a6cc40" />
    <path d="M72 92 Q79 134 106 148 Q129 162 151 158 L155 166 Q131 170 108 158 Q81 146 74 124Z" fill="#73ad38" />
    <path d="M128 151 Q133 163 146 173 L142 163 L152 171 L148 158 L158 164 L151 148Z" fill="#92c43b" />
    <g ref={nearWing} className="parrot-near-wing">
      <path d="M113 116 Q133 80 176 64 Q215 53 235 26 Q225 57 207 71 Q225 66 235 61 Q224 81 203 88 Q217 91 229 87 Q213 104 195 105 Q209 112 220 109 Q201 123 184 119 Q197 131 207 130 Q185 137 170 129 Q180 145 191 145 Q170 147 156 136 Q160 151 173 158 Q152 153 143 140 Q146 156 155 164 Q133 153 124 134Z" fill="#ffdb26" />
      <path d="M113 116 Q136 88 173 75 Q151 105 142 135 Q137 143 143 151 Q122 142 113 126Z" fill="#f3bd19" />
      <path d="M106 111 Q130 86 161 72 Q197 56 215 32 L222 9 Q218 49 186 78 Q158 107 142 123 Q122 136 106 124 Q101 120 106 111Z" fill="#36913b" />
      <path d="M119 128 Q145 117 163 94 Q176 76 188 68 Q165 99 157 120 Q143 138 127 139Z" fill="#9ec63c" />
      <path d="M166 94 Q187 99 204 87 M158 109 Q176 119 195 105 M151 123 Q163 136 184 131 M143 135 Q151 149 165 154" stroke="#f5ca20" strokeWidth="1.7" strokeLinecap="round" />
    </g>
    <g ref={foldedWing} className="parrot-folded-wing" opacity="0"><path d="M98 105 Q124 106 143 148 Q129 157 113 143 Q99 128 98 105Z" fill="#398f3b" /><path d="M107 115 Q123 130 137 146 Q129 149 121 139Z" fill="#7fb83b" /><path d="M129 141 L143 148 L135 151Z" fill="#f7d52a" /></g>
    <g ref={head} className="parrot-head">
    <path d="M48 58 Q59 44 77 50 Q94 54 103 77 Q110 91 104 105 Q93 116 78 106 Q73 100 68 91 Q52 88 47 76Z" fill="#a6cc40" />
    <path d="M49 61 Q63 51 79 65 Q86 71 89 79 L85 78 Q94 85 93 88 L87 87 Q95 94 93 96 L87 94 Q92 102 88 104 L83 99 Q85 108 81 108 L77 102 Q78 111 73 110 L70 103 Q68 112 65 107 L63 99 Q52 95 49 84Z" fill="#ffdc29" />
    <path d="M46 62 C37 60 32 70 35 79 Q37 85 42 88 Q39 79 47 76 L54 70 Q52 64 46 62Z" fill="#79aa96" />
    <path d="M47 76 L43 80 Q47 82 50 85 L51 75Z" fill="#245e5c" />
    <g ref={eye} className="parrot-eye"><circle cx="64" cy="67" r="4.2" fill="#111b15" /><circle cx="65.1" cy="65.8" r="1.25" fill="white" /></g>
    </g>
    </g>
    <g ref={feet} className="parrot-feet" opacity="0" stroke="#596c36" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path ref={leftFoot} className="parrot-foot parrot-left-foot" d="M108 155 L106 170 L107 182 M107 182 Q104 181 100 184 M107 182 Q110 181 113 183" /><path ref={rightFoot} className="parrot-foot parrot-right-foot" d="M123 159 L125 172 L124 182 M124 182 Q120 181 117 184 M124 182 Q128 181 131 184" /></g>
  </svg>;
}
