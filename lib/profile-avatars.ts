export const PROFILE_AVATARS = Array.from({ length: 20 }, (_, index) => `/api/avatars/${index + 1}`)

export function defaultProfileAvatar(identity: string): string {
  let hash = 0
  for (const letter of identity) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0
  return PROFILE_AVATARS[hash % PROFILE_AVATARS.length]
}

const BACKGROUNDS = ["#dceaff", "#ffe8d4", "#e5dcff", "#d4f4e8", "#ffe0ec"]
const SHIRTS = ["#245ab6", "#a14325", "#6340a9", "#14795b", "#b73169"]
const SKIN = ["#efc4a4", "#b97950", "#e4ab82", "#8f593e"]

export function profileAvatarSvg(index: number): string {
  const background = BACKGROUNDS[index % 5]
  const shirt = SHIRTS[index % 5]
  const skin = SKIN[Math.floor(index / 5)]
  const hair = index % 2 ? "#362a28" : "#162544"
  const accessory = index % 4 === 0
    ? '<g fill="none" stroke="#162544" stroke-width="3"><rect x="31" y="46" width="16" height="11" rx="4"/><rect x="53" y="46" width="16" height="11" rx="4"/><path d="M47 50h6"/></g>'
    : index % 4 === 1 ? `<path d="M23 30Q50 4 77 30v7H23z" fill="${shirt}"/>`
      : index % 4 === 2 ? `<circle cx="27" cy="56" r="4" fill="#ffc84c"/><circle cx="73" cy="56" r="4" fill="#ffc84c"/>` : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${background}"/><path d="M14 100v-8c0-22 16-31 36-31s36 9 36 31v8" fill="${shirt}"/><path d="M43 61h14v15H43z" fill="${skin}"/><ellipse cx="50" cy="44" rx="25" ry="29" fill="${hair}"/><ellipse cx="50" cy="49" rx="22" ry="25" fill="${skin}"/><path d="${index % 2 ? "M27 42V30q23-23 46 0v13Q56 34 52 25q-8 13-25 17" : "M27 39V28q23-20 46 0v10Q48 22 27 39"}" fill="${hair}"/><g fill="#252334"><circle cx="39" cy="49" r="2"/><circle cx="61" cy="49" r="2"/></g><path d="M43 60q7 7 14 0" fill="none" stroke="#934e42" stroke-width="2" stroke-linecap="round"/>${accessory}<path d="M37 79l13 9 13-9" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/></svg>`
}
