import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

export interface Country {
  iso: CountryCode
  name: string
  dial: string
}

export const DEFAULT_COUNTRY: CountryCode = 'TG'

const names = new Intl.DisplayNames(['fr'], { type: 'region' })

export const COUNTRIES: Country[] = getCountries()
  .map<Country>((iso) => ({ iso, name: names.of(iso) ?? iso, dial: `+${getCountryCallingCode(iso)}` }))
  .sort((a, b) => (a.iso === DEFAULT_COUNTRY ? -1 : b.iso === DEFAULT_COUNTRY ? 1 : a.name.localeCompare(b.name, 'fr')))

export function findCountry(iso: string): Country | undefined {
  return COUNTRIES.find((country) => country.iso === iso)
}

export function toInternationalPhone(iso: CountryCode, national: string): string | null {
  const parsed = parsePhoneNumberFromString(national, iso)
  return parsed?.isValid() ? parsed.number : null
}
