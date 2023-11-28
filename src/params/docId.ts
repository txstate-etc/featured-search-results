/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match (param) {
  return /^[a-f0-9]+$/i.test(param)
}
