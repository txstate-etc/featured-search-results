<script lang='ts' context='module'>
  import { htmlEncode } from 'txstate-utils'

  const incompatibleTypes = new Set(['undefined', 'function', 'symbol'])
  const nestingDefaultTypes = new Set(['object', 'array'])
  const arithmeticTypes = new Set(['number', 'bigint', 'boolean'])

  /** `typeof` operator doesn't distinguish between 'object' and 'array' and we want the distinction here. */
  type EnhancedTypes = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'
  export interface TableData extends Record<string, any> {}
  export interface PropMeta { key: string, type: EnhancedTypes, isComplex: boolean }
  export interface Transforms extends Record<string, (e: any) => string> {}
  export interface Sortings extends Record<string, (a: any, b: any) => number> {}
  export interface ResponsiveTableProps {
    propsMetas: PropMeta[] | undefined
    caption: string | undefined
    transforms: Transforms | undefined
    sortings: Sortings | undefined
    getNestingKeys: ((data: Record<string, any>[]) => string[]) | undefined
  }

  /** Returns an array of { key, type, isComplex } records that describe the properties of the `obj`. */
  function getMetaData (obj: any) {
    return Object.keys(obj).reduce<PropMeta[]>((wanted, key) => {
      let type: EnhancedTypes = typeof obj[key]
      if (type === 'object' && obj[key].length !== undefined) type = 'array'
      if (!incompatibleTypes.has(type)) {
        const isComplex = nestingDefaultTypes.has(type)
        wanted.push({ key, type, isComplex })
      }
      return wanted
    }, [])
  }

  function isAlternate (i: number) {
    return (i % 2) > 0
  }

</script>
<script lang='ts'>

  /* TODO:
     1) Add `rollupSize` option to resize rows that are `rollupSize` lines tall.
     2) Add hidden sort <select> with <asc|desc> button(?) that displays in mobile media mode.
  */

  /** Array of `Record<string, any>[]` records to generate a table for. Uses the first element to figure out the shape of the data. All
   * elements MUST be uniform with the first, or at least have values corresponding to the compatible properties in that first record. */
  export let data: Record<string, any>[]
  export let caption: string | undefined
  /** Whether to sort nestable props to the end of the record and nest them on their own rows after all "simple" value props have been displayed on a common row. */
  export let nesting: boolean | undefined = !true
  /** Pass in any special transfrom functions, keyed by the property names in your data, that generate html based on the element passed in. Only used
   * on data rows. Useful for turning data elements into hyperlinks or buttons in the table. */
  export let transforms: Transforms | undefined = {}
  /** Pass in any special sort handling functions, keyed by the property names in your data. */
  export let sortings: Sortings | undefined = {}
  /** Optional function bind to return an array of property names to nest on their own row.
   * Useful for overriding default behavior of doing so for all objects and arrays when `nesting` is enabled. */
  export let getNestingKeys: (data: Record<string, any>[]) => string[] = (data: Record<string, any>[]) => {
    const meta = getMetaData(data[0])
    return meta.filter(m => nestingDefaultTypes.has(m.type)).map(m => m.key)
  }
  /** Rather than let `ResponsiveTable` generate the default metadata definitions its using to drive its output
   * you can supply your own metadata descriptor via this bind.
   * @note Will have an a value of `undefined` until the table is mounted/initialized. */
  export let propsMetas: PropMeta[] | undefined
  propsMetas = propsMetas ? sortByNesting(propsMetas) : sortByNesting(getMetaData(data[0]))

  /** Formats `obj` based on any transformations passed for its associated heading type. If none are supplied it defaults
  * to recursively handling any `obj` that are `typeof 'object'` with no extra labeling or indenting of array elements
  * but adding such to any sub-objects found whenther they are found in a parent object or as an object that is an
  * element of an array.
  * Non-object array elements are encoded to escape any reserved HTML characters.
  * For everything else that doesn't have a custom transformation supplied it encodes the output to escape reserved HTML
  * characters. */
  const format: (meta: PropMeta, obj: any) => string = (meta: PropMeta, obj: any) => {
    if (transforms?.[meta.key]) return transforms[meta.key](obj)
    if (typeof obj === 'object') { // Recurse
      if (obj.length === undefined) { // not array - iterate keys to recurse adding labels and indentation
        const objMetas = getMetaData(obj)
        return `
          <div style='padding-left: 0.4rem'>
            ${objMetas.map(p => {
                return `<div><label style='text-transform: capitalize'>${p.key}: </label>${format(p, obj[p.key])}`
              }).join('</div><div>')
            }</div>
          </div>`
      } // array - iterate elements to recurse
      return `
        <div style='padding-left: 0.4rem'>
          <div>${obj.map((e: any) => format({ key: meta.key, type: 'array', isComplex: true }, e)).join('</div><div>')}</div>
        </div>`
    }
    // Our containing prop's type was an array but the obj element is neither an object nor array.
    if (meta.type === 'array') {
      return `<div>${htmlEncode(obj)}</div>`
    } // All other single-value types.
    return htmlEncode(obj)
  }

  const nestingKeys = new Set(nesting ? getNestingKeys(data) : [])

  const plainMetas = propsMetas ? propsMetas.filter(h => !nestingKeys.has(h.key)) : []
  const nestedMetas = propsMetas ? propsMetas.filter(h => nestingKeys.has(h.key)) : []
  const simpleMetas = propsMetas ? propsMetas.filter(h => !nestingDefaultTypes.has(h.type)) : []

  const longestKey = simpleMetas.reduce((a, b) => Math.max(a, b.key.length), 0) + 1 + 'ch'
  let tableRoot: HTMLElement
  $: tableRoot && tableRoot.style.setProperty('--longest-key', longestKey)

  /** Sorts `meta` by meta.key exisiting in `nestingKeys` if `nesting` is enabled. */
  function sortByNesting (meta: PropMeta[]) {
    return nesting
      ? meta.sort((a, b) => { return Number(nestingKeys.has(a.key)) - Number(nestingKeys.has(b.key)) })
      : meta
  }

  let ascending = true
  let selectedHeading = ''
  /** Sorts `data` by the heading { key, type } data associated with the records in it. Array properties are sorted by their length.
   * Also handles updating what heading is selected for soriting and toggling asc/desc. */
  function sortByHeading (meta: PropMeta) {
    if (meta.key !== selectedHeading) { // Reset column state and resort.
      selectedHeading = meta.key
      ascending = true
      if (sortings?.[meta.key]) {
        data = data.sort((a, b) => { return sortings![meta.key](a[meta.key], b[meta.key]) })
      } else if (arithmeticTypes.has(meta.type)) {
        data = data.sort((a, b) => { return a[meta.key] - b[meta.key] })
      } else if (meta.type === 'string') {
        data = data.sort((a, b) => { return a[meta.key].localeCompare(b[meta.key], undefined, { sensitivity: 'accent' }) })
      } else if (meta.type === 'array') { // Sort by length of each array.
        data = data.sort((a, b) => { return a[meta.key].length - b[meta.key].length })
      } else { // Sort by number of keys in an object.
        data = data.sort((a, b) => { return Object.keys(a[meta.key]).length - Object.keys(b[meta.key]).length })
      }
    } else {
      ascending = !ascending
      data = data.reverse()
    }
  }

  let lastRecordIndex = 0
  /** Utility function for detecting when we're working with a different record. */
  function isNextRecord (i: number) {
    if (i === lastRecordIndex) return false
    lastRecordIndex = i; return true
  }

  /** Utility function for detecting when we're working with the first property of a record.
   *  Useful for adding top of record formatting. */
  function isFirstProp (key: string) {
    return propsMetas![0].key === key
  }
  /** Utility function for detecting when we're working with the bottom property of a record.
   *  If `record` is included it will check if any props of record after `key` have data and
   *  return true if everything after `key` is effectively empty. Useful for adding bottom of
   *  record formatting. */
  function isBottomProp (key: string, record?: any) {
    if (record) {
      return propsMetas!.findIndex(p => p.key === key) >= propsMetas!.findLastIndex(l => dataPresent(record[l.key]))
    } else if (nestedMetas.length === 0) return true
    return propsMetas![propsMetas!.length - 1].key === key
  }

  function dataPresent (obj: any) {
    if (obj.length !== undefined) return obj.length > 0
    if (obj.size !== undefined) return obj.size > 0
    return obj !== undefined
  }
</script>

{#if propsMetas}
<div class:table-container={true}>
  <table bind:this={tableRoot}>
    <slot name='caption' {data}>
      {#if caption}
        <caption>{caption}</caption>
      {/if}
    </slot>
    <thead>
      {#if plainMetas.length}
        <tr class:bottom-heading-row={nestedMetas.length === 0}>
          {#each plainMetas as plainHead}
            <th
              class:selected-heading={plainHead.key === selectedHeading}
              aria-sort={plainHead.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
              on:click={() => { sortByHeading(plainHead) }}>{plainHead.key.replace('_', ' ')}
              <slot name='sortIcon' {ascending} {selectedHeading} key={plainHead.key}>
                <span hidden={plainHead.key !== selectedHeading} class='order-icon'>{@html ascending ? '&#9661;' : '&#9651;'}</span>
              </slot>
            </th>
          {/each}
        </tr>
      {/if}
      {#each nestedMetas as nestedHead}
        <tr class:bottom-heading-row={isBottomProp(nestedHead.key)}>
          <th
            class:nested-container={true}
            colspan={plainMetas.length ?? 1}
            class:selected-heading={nestedHead.key === selectedHeading}
            aria-sort={nestedHead.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
            on:click={() => { sortByHeading(nestedHead) }}>{nestedHead.key.replace('_', ' ')}
            <slot name='sortIcon' {ascending} {selectedHeading} key={nestedHead.key}>
              <span hidden={nestedHead.key !== selectedHeading} class:order-icon={true}>{@html ascending ? '&#9661;' : '&#9651;'}</span>
            </slot>
          </th>
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each data as record, i}<!-- Note that `i` cannot be passed to slots. -->
        <slot name='record' {record} {propsMetas} {simpleMetas} {plainMetas} {nestedMetas} colspan={plainMetas.length ?? 1} {longestKey} {isBottomProp} {isAlternate} {dataPresent} {format}>
          {#if plainMetas.length}
            <tr class:opaqued={isAlternate(i)}
              class:bottom-record-row={isBottomProp(plainMetas[plainMetas.length - 1].key, record)}>
              <slot name='plainRowContent' {record} {plainMetas} {format}>
                {#each plainMetas as dataMeta}
                  <td data-key={dataMeta.key.replace('_', ' ')}
                    class:complex-container={dataMeta.isComplex}
                    class:simple-container={!dataMeta.isComplex}>
                    <slot name='plainDataContent' {record} {dataMeta} {format}>
                      <!-- By default we spread array elements into seperate blocks nested in complex-container responsiveness block. -->
                      {#if dataMeta.type === 'array'}
                        <div class:complex-container={true}>
                          <slot name='plainArrayContent' {record} {dataMeta} {format}>
                            {#each record[dataMeta.key] as element}
                                <slot name='plainArrayElementContent' {record} {dataMeta} {element} {format}>
                                  {@html format(dataMeta, element)}
                                </slot>
                            {/each}
                          </slot>
                        </div>
                      {:else}
                        <div class:complex-container={dataMeta.isComplex}>
                          <slot name='plainSingletonContent' {record} {dataMeta} {format}>
                            {@html format(dataMeta, record[dataMeta.key])}
                          </slot>
                        </div>
                      {/if}
                    </slot>
                  </td>
                {/each}
              </slot>
            </tr>
          {/if}
          {#each nestedMetas as dataMeta}
            {#if dataPresent(record[dataMeta.key])}
              <slot name='nestedRows' {record} {nestedMetas} {dataMeta} colspan={plainMetas.length ?? 1} {isBottomProp} {isAlternate} {format}>
                <tr class:opaqued={isAlternate(i)}
                  class:bottom-record-row={isBottomProp(dataMeta.key, record)}>
                  <slot name='nestedRowContent' {record} {dataMeta} colspan={plainMetas.length ?? 1} {format}>
                    <td data-key={dataMeta.key.replace('_', ' ')}
                      class:nested-container={true}
                      colspan={plainMetas.length ?? 1}>
                      <slot name='nestedDataContent' {record} {dataMeta} {format}>
                      <!-- By default we spread array elements into seperate blocks nested in complex-container responsiveness block. -->
                        {#if dataMeta.type === 'array'}
                          <div class:complex-container={true}>
                            <slot name='nestedArrayContent' {record} {dataMeta} {format}>
                              {#each record[dataMeta.key] as element}
                                <slot name='nestedArrayElementContent' {record} {dataMeta} {element} {format}>
                                  {@html format(dataMeta, element)}
                                </slot>
                              {/each}
                            </slot>
                          </div>
                        {:else}
                          <div class:complex-container={dataMeta.isComplex}>
                            <slot name='nestedSingletonContent' {record} {dataMeta} {format}>
                              {@html format(dataMeta, record[dataMeta.key])}
                            </slot>
                          </div>
                        {/if}
                      </slot>
                    </td>
                  </slot>
                </tr>
              </slot>
            {/if}
          {/each}
        </slot>
      {/each}
    </tbody>
  </table>
</div>
{:else}
  No metaData!
{/if}

<style>
  .bottom-heading-row {
    border-bottom: 1px solid hsl(0 0% 0% / 0.6);
  }
  .bottom-record-row {
    border-bottom: 1px solid hsl(0 0% 0% / 0.2);
  }
  .opaqued {
    background: hsl(0 0% 0% / 0.1);
  }
  .table-container {
    width: min(900px, 100% - 3rem);
    margin-inline: auto;
    overflow-x: auto;
  }
  .selected-heading {
    font-weight: 700;
  }
  .nested-container {
    padding-left: 0.5rem;
  }
  div.complex-container {
    columns: 12rem auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  caption,th,td {
    padding: 0.2rem;
  }
  caption,th {
    text-align: left;
  }
  caption {
    font-size: 1.5rem;
    font-weight: 700;
    text-transform: capitalize;
  }
  th {
    background: hsl(0 0% 0% / 0.5);
    text-transform: capitalize;
    cursor: pointer;
  }
  tr {
    border-bottom: 1px solid hsl(0 0% 0% / 0.05);
    vertical-align: top;
  }
  @media (max-width: 650px) {
    th {
      display: none;
    }
    div.complex-container {
      columns: 12rem auto;
      padding-left: 0.7rem;
    }
    td {
      padding: 0.02rem;
    }
    td.simple-container {
      display: grid;
      grid-template-columns: var(--longest-key) auto;
    }
    td.complex-container {
      display: grid;
      grid-template-columns: auto;
    }
    .nested-container {
      padding-left: 0rem;
    }
    td:first-child {
      padding-top: 0.1rem;
    }
    td:last-child {
      padding-bottom: 0.1rem;
    }
    td::before {
      content: attr(data-key) ':';
      font-weight: 630;
      text-transform: capitalize;
      padding-left: 0.3rem;
    }
  }
</style>
