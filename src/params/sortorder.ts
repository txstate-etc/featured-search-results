/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match (param) {
  return /^(desc|asc)$/.test(param)
}
