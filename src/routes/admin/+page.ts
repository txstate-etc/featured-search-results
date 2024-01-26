import { appBase } from '$lib/util/globals'
import { redirect, type Load } from '@sveltejs/kit'

export const load: Load = async () => {
  throw redirect(301, `${appBase}/results`)
}
