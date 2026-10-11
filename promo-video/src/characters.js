// Flat poster-style characters (inline SVG, thick black outlines).
// Colours come from CSS variables so a character can "light up" yellow:
// --skin, --cloth, --hair, --pants, --cone (spotlight opacity), --rim.

const limb = (d, fill = 'var(--cloth)', w = 24) =>
  `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="${w + 12}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

const O = 'stroke="var(--ink)" stroke-width="6" stroke-linejoin="round"';

function pedestal() {
  return `
  <g class="ped">
    <polygon class="cone" points="124,-30 22,338 226,338" fill="var(--yellow)" opacity="var(--cone)"/>
    <path d="M22 340 L22 382 Q124 412 226 382 L226 340 Z" fill="var(--ink)"/>
    <ellipse cx="124" cy="340" rx="104" ry="22" fill="#2a2826" stroke="var(--rim)" stroke-width="6"/>
  </g>`;
}

function legs() {
  return `
  ${limb('M108 270 L104 330', 'var(--pants)', 26)}
  ${limb('M140 270 L144 330', 'var(--pants)', 26)}
  <ellipse cx="98" cy="336" rx="22" ry="10" fill="var(--ink)"/>
  <ellipse cx="150" cy="336" rx="22" ry="10" fill="var(--ink)"/>`;
}

const torso = (extra = '') => `
  <path d="M84 178 Q84 156 108 154 L140 154 Q164 156 164 178 L170 276 L78 276 Z" fill="var(--cloth)" ${O}/>
  ${extra}`;

const head = (inner) => `
  <rect x="112" y="140" width="24" height="22" fill="var(--skin)" ${O}/>
  <circle cx="124" cy="110" r="44" fill="var(--skin)" ${O}/>
  ${inner}`;

export const CHARACTERS = [
  {
    id: 'brain',
    name: 'МОЗЪКЪТ',
    stat: 'ЛОГИКА',
    value: 95,
    svg: `
    ${pedestal()}
    <g class="body">
      ${legs()}
      ${torso('<path d="M110 156 L124 180 L138 156 Z" fill="var(--ink)"/>')}
      <!-- left arm holding a book -->
      <g>${limb('M90 174 L80 214 L84 252')}
        <rect x="56" y="214" width="34" height="50" rx="4" fill="var(--ink)" transform="rotate(-8 73 239)"/>
        <rect x="84" y="218" width="6" height="42" fill="var(--grey)" transform="rotate(-8 73 239)"/>
        <circle cx="84" cy="252" r="11" fill="var(--skin)" ${O}/>
      </g>
      ${head(`
        <path d="M80 104 Q80 62 124 62 Q170 62 168 106 Q156 84 120 86 Q96 88 80 104 Z" fill="var(--hair)" ${O}/>
        <path d="M112 140 Q124 147 136 140" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>
        <circle cx="108" cy="113" r="4.5" fill="var(--ink)"/><circle cx="140" cy="113" r="4.5" fill="var(--ink)"/>
      `)}
      <g class="glasses">
        <circle cx="108" cy="113" r="14" fill="rgba(236,231,219,0.25)" stroke="var(--ink)" stroke-width="5"/>
        <circle cx="140" cy="113" r="14" fill="rgba(236,231,219,0.25)" stroke="var(--ink)" stroke-width="5"/>
        <path d="M122 112 L126 112" stroke="var(--ink)" stroke-width="5"/>
        <path class="glint" d="M134 104 L142 100" stroke="var(--cream)" stroke-width="4" stroke-linecap="round" opacity="0"/>
      </g>
      <!-- right arm pushing the glasses up -->
      <g class="arm-up">${limb('M160 174 L186 150 L150 122')}
        <circle cx="150" cy="120" r="11" fill="var(--skin)" ${O}/>
      </g>
    </g>`,
  },
  {
    id: 'leader',
    name: 'ЛИДЕРЪТ',
    stat: 'КОМАНДВАНЕ',
    value: 90,
    svg: `
    ${pedestal()}
    <g class="body">
      ${legs()}
      ${torso(`<path d="M108 156 L124 196 L112 160 Z M140 156 L124 196 L136 160 Z" fill="var(--ink)"/>
               <path d="M108 154 L124 176 L140 154" fill="var(--skin)" ${O}/>`)}
      <g class="headg">
      ${head(`
        <path d="M80 102 Q74 58 120 52 Q150 46 164 64 Q176 80 168 104 Q160 80 134 82 Q110 72 80 102 Z" fill="var(--hair)" ${O}/>
        <path d="M100 100 L116 104" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>
        <path d="M132 104 L148 98" stroke="var(--ink)" stroke-width="6" stroke-linecap="round" class="brow"/>
        <path d="M100 116 Q108 112 116 116" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>
        <path d="M132 116 Q140 112 148 116" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>
        <path d="M110 136 Q128 146 142 130" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>
      `)}
      </g>
      <!-- arms crossed -->
      ${limb('M88 176 L84 204')}
      ${limb('M160 176 L164 204')}
      ${limb('M86 206 L156 218')}
      <circle cx="160" cy="218" r="11" fill="var(--skin)" ${O}/>
      ${limb('M162 204 L92 218')}
      <circle cx="88" cy="218" r="11" fill="var(--skin)" ${O}/>
    </g>`,
  },
  {
    id: 'seeker',
    name: 'ТЪРСАЧЪТ',
    stat: 'ВНИМАНИЕ',
    value: 95,
    svg: `
    ${pedestal()}
    <g class="body">
      ${legs()}
      ${torso(`<rect x="80" y="226" width="88" height="14" fill="var(--ink)"/>
               <path d="M124 156 L124 276" stroke="var(--ink)" stroke-width="5"/>`)}
      ${limb('M88 176 L80 214 L86 254')}
      <circle cx="86" cy="256" r="11" fill="var(--skin)" ${O}/>
      ${head(`
        <path d="M78 104 Q80 58 124 58 Q168 58 170 104 Z" fill="var(--hair)" ${O}/>
        <rect x="76" y="94" width="96" height="14" rx="6" fill="var(--yellow)" ${O}/>
        <path d="M150 100 Q186 96 194 108 L168 108 Z" fill="var(--hair)" ${O}/>
        <g class="eyes"><circle cx="112" cy="120" r="5" fill="var(--ink)"/><circle cx="144" cy="120" r="5" fill="var(--ink)"/></g>
        <circle cx="130" cy="142" r="6" fill="var(--ink)"/>
      `)}
      <!-- right arm with the flashlight and its beam -->
      <g class="torch">
        <polygon points="226,196 380,120 380,280" fill="var(--yellow)" opacity="calc(var(--cone) * 1.6)"/>
        ${limb('M160 176 L190 200 L212 198')}
        <rect x="204" y="186" width="40" height="22" rx="5" fill="var(--ink)" transform="rotate(-6 224 197)"/>
        <rect x="238" y="182" width="10" height="30" rx="3" fill="var(--grey)" stroke="var(--ink)" stroke-width="4" transform="rotate(-6 224 197)"/>
        <circle cx="208" cy="198" r="11" fill="var(--skin)" ${O}/>
      </g>
    </g>`,
  },
  {
    id: 'panic',
    name: 'ПАНИКЬОРЪТ',
    stat: 'ПАНИКА',
    value: 100,
    svg: `
    ${pedestal()}
    <g class="body">
      ${legs()}
      ${torso('<path d="M84 200 L166 200 M82 232 L168 232" stroke="var(--ink)" stroke-width="5"/>')}
      ${limb('M88 176 L96 220 L140 226')}
      <circle cx="142" cy="226" r="11" fill="var(--skin)" ${O}/>
      ${head(`
        <path d="M80 104 L76 74 L94 84 L96 56 L112 76 L124 48 L134 74 L152 54 L154 82 L172 72 L168 104 Q150 86 124 88 Q98 86 80 104 Z" fill="var(--hair)" ${O}/>
        <circle cx="106" cy="114" r="13" fill="var(--cream)" stroke="var(--ink)" stroke-width="5"/>
        <circle cx="142" cy="114" r="13" fill="var(--cream)" stroke="var(--ink)" stroke-width="5"/>
        <circle class="pupil" cx="106" cy="114" r="3.5" fill="var(--ink)"/><circle class="pupil" cx="142" cy="114" r="3.5" fill="var(--ink)"/>
        <path d="M94 94 L114 100 M154 94 L134 100" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>
      `)}
      <!-- hand at the mouth, biting nails -->
      <g class="bite">${limb('M160 176 L176 212 L134 148')}
        <circle cx="130" cy="144" r="12" fill="var(--skin)" ${O}/>
        <path d="M122 136 L120 130 M128 134 L128 127 M134 135 L136 129" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
      </g>
      <g class="sweat">
        <path class="drop d1" d="M176 84 Q186 98 180 104 Q170 108 168 98 Q170 92 176 84 Z" fill="var(--cream)" stroke="var(--ink)" stroke-width="4"/>
        <path class="drop d2" d="M70 96 Q78 108 74 114 Q64 116 62 108 Q64 102 70 96 Z" fill="var(--cream)" stroke="var(--ink)" stroke-width="4"/>
        <path class="drop d3" d="M184 120 Q192 130 188 135 Q180 138 178 131 Q180 126 184 120 Z" fill="var(--cream)" stroke="var(--ink)" stroke-width="4"/>
      </g>
    </g>`,
  },
];
