<script lang='ts' context='module'>
  import { htmlEncode } from 'txstate-utils'

  const incompatibleTypes = new Set(['undefined', 'function', 'symbol'])
  const nestingDefaultTypes = new Set(['object', 'array'])
  const arithmeticTypes = new Set(['number', 'bigint', 'boolean'])

  /** `typeof` operator doesn't distinguish between 'object' and 'array' and we want the distinction here. */
  type EnhancedTypes = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'
  export interface TableData extends Record<string, any> {}
  export interface PropMeta { key: string, type: EnhancedTypes, shouldNest: boolean }
  export interface HeadingTexts extends Record<string, string> {}
  export interface Transforms extends Record<string, (value: any, record: any) => string> {}
  export interface Sortings extends Record<string, (a: any, b: any) => number> {}
  export interface ResponsiveTableProps {
    propsMetas: PropMeta[] | undefined
    caption: string | undefined
    spanning: boolean | undefined
    nesting: boolean | undefined
    headingTexts: HeadingTexts | undefined
    transforms: Transforms | undefined
    sortings: Sortings | undefined
    getNestingKeys: ((data: TableData[]) => string[]) | undefined
    getRowspanKeys: ((data: TableData[]) => string[]) | undefined
  }
  export const SpanningMetaSym = Symbol.for('SpanningMeta')

  function getNetingKeysDefaults (data: TableData[]) {
    const meta = getMetaData(data[0])
    return meta.filter(m => nestingDefaultTypes.has(m.type)).map(m => m.key)
  }
  function getRowspanKeysDefaults (data: TableData[]) {
    const meta = getMetaData(data[0])
    return meta.filter(m => !m.shouldNest).map(m => m.key)
  }

  /** Utility function for getting the `typeof` an object with `array` differentiated from `object`. */
  function getType (obj: any) {
    let type: EnhancedTypes = typeof obj
    if (type === 'object' && obj?.length !== undefined) type = 'array'
    return type
  }

  /** Returns an array of { key, type, shouldNest } records that describe the properties of the `obj`. */
  function getMetaData (obj: any) {
    return Object.keys(obj).reduce<PropMeta[]>((wanted, key) => {
      const type: EnhancedTypes = getType(obj[key])
      if (!incompatibleTypes.has(type)) {
        const shouldNest = nestingDefaultTypes.has(type)
        wanted.push({ key, type, shouldNest })
      }
      return wanted
    }, [])
  }

  /** Utility function for verbalizing the purpose of checking for even or odd values. Returns true if `i` is even. */
  function isAlternate (i: number) {
    return (i % 2) > 0
  }

  /** Transforms `data` creating new records for each element found in the subproperty arrays of `data`'s records. The
   * arrays that this is performed for is limited by inclusion in the `subrowMetas: PropMeta[]` parameter.
   *
   * All records are clones of the original record, minus the array being interpolated into the data but including that
   * array's corresponding element data. If we were running this on one record and interpolating an array property of that
   * record then that record would be transformed into a number of records equal to the length of that array with each
   * record returned being the equivalent of the rest (`...element`) expanded values of the array's corresponding element,
   * and the rest expansion of the source record's values minus the interpolated array.
   *
   * Since we're transforming records into multiple clones of their source record a means of conveniently tracking the new
   * record's context to the original record is provided with the following properties being added to the record under the
   * exported `SpanningMetaSym` global Symbol:
   - `groupIdx` - The index of the source record in the original array of records.
   - `groupStartRecIdx` - The index value in the resulting array of records where the source record's group starts.
   - `groupEndRecIdx` - The index value in the resulting array of records where the source record's group ends.
   - `rowspan: { [interpolated_key]: source[interpolated_key].length }`
   - `totalRowspan` - The sum of all the values in the `rowspan` object above. */
  function interpolateSpanning (data: any, subrowMetas: PropMeta[]) {
    const interpolated = subrowMetas.reduce((interpolate, meta) => {
      if (meta.type === 'array') {
        return interpolate.map((rec: any, idx: number) => {
          const rowspan = rec[meta.key].length
          return rec[meta.key].map((element: any) => {
            const { [meta.key]: _, ...rest } = rec
            const ret = {
              ...rest,
              ...element,
              [SpanningMetaSym]: {
                groupIdx: rest.groupIdx ?? idx,
                rowspan: {
                  ...rest[SpanningMetaSym]?.rowspan,
                  [meta.key]: rowspan
                }
              }
            }
            return ret
          })
        }).flat()
      }
      return interpolate
    }, data)

    let grpOffset = 0
    for (let i = 0; i < interpolated.length; i++) {
      const oref = interpolated[i][SpanningMetaSym]
      const grpIdx = oref.groupIdx
      const totalRowspan = Object.values<number>(oref.rowspan).reduce<number>((acc, curr) => acc + curr, 0)
      const nextGrpStartRecIdx = grpOffset + totalRowspan
      while (interpolated[i]?.[SpanningMetaSym].groupIdx === grpIdx) {
        const iref = interpolated[i][SpanningMetaSym]
        iref.groupStartRecIdx = grpOffset
        iref.totalRowspan = totalRowspan
        iref.groupEndRecIdx = nextGrpStartRecIdx - 1
        i++
      }
      grpOffset = nextGrpStartRecIdx
    }
    return interpolated
  }

</script>
<script lang='ts'>

  /* TODO:
     1) Add `rollupSize` option to resize rows that are `rollupSize` lines tall.
     2) Add hidden sort <select> with <asc|desc> button(?) that displays in mobile media mode.
       2 Addendum)
        The whole sort approach here might not be the way to go. It's great for sorting in page
        records that are fetched and displayed in the table but often times users will expect
        sorts to operate on the whole paginated set bringing the data not displayed up to the top
        of the displayed set.
        - May consider revisiting sort to pass in optional `asyncSortings` that call API sorting
          endpoints. With that as an option consumer paginators can have the callbacks passed in
          reference pagination bounds for the API endpoints to return on their sort.
        - The paginator could then control whether sorting refreshes from page 1 of the paginated
          data - effectively resetting most of its state as well as the `data` bound to this - or
          if they are required to do something funky they can.
        - This async sort should become the default handling if provided but there should also be
          an option to provide in page sorting or both options for users who are experts in data
          analysis enough to recognise the value of different sorting granularities.
  */

  /** Array of `TableData[]` records to generate a table for. Uses the first element to figure out the shape of the data. All
   * elements MUST be uniform with the first, or at least have values corresponding to the compatible properties in that first record. */
  export let data: TableData[] = []
  export let caption: string | undefined = undefined
  /** Whether to flatten first level arrays into new records with repeating values for the remaining properties of the record.
   * Those repeated values would then be rowspanned accross the length of their longest array. */
  export let spanning: boolean | undefined = !true
  /** Whether to sort nestable props to the end of the record and nest them on their own rows after all "simple" value props have been displayed on a common row. */
  export let nesting: boolean | undefined = !true
  /** Pass in any special transfrom functions, keyed by the property names in your data, that generate html based on the element passed in. Only used
   * on data rows. Useful for turning data elements into hyperlinks or buttons in the table. */
  export let transforms: Transforms | undefined = {}
  /** Pass in any special sort handling functions, keyed by the property names in your data. */
  export let sortings: Sortings | undefined = {}
  export let headingTexts: HeadingTexts | undefined = {}
  /** Optional function bind to return an array of property names to nest on their own row.
   * Useful for overriding default behavior of doing so for all objects and arrays when `nesting` is enabled. */
  export let getNestingKeys: (data: TableData[]) => string[] = getNetingKeysDefaults
  /** Optional function bind to return an array of property names to peform rowspanning on across rows.
   * Useful for record sets with repeating key values. */
  export let getRowspanKeys: (data: TableData[]) => string[] = getRowspanKeysDefaults
  /** You may well want to define what you want the table to render using your own `PropMeta[]` defintion.
   * Only record properties with keys defined in your custom defintion will be shown. They will also
   * be evaluated in the order you specify in your custom spec with the exception of `nesting` causing
   * nestable props to move to the end of the props maintaining their order with respect to themselves.
   * If you're `spanning` then the algorithm for interpolating spanned data will use the as-is shape of
   * the `data` passed to this component to find the props not specified by `getRowspanKeys` and build the
   * spanning contextualized data from that shape definition. This means your custom `propsMetas` can
   * include properties that would be extrapolated from the arrays that are not members of your Rowspan
   * keys. */
  export let propsMetas: PropMeta[] | undefined = undefined

  function getHeadingText (key: string) {
    return headingTexts?.[key] ?? key.replace('_', ' ')
  }

  /** Formats `obj` based on any transformations passed for its associated heading type. If none are supplied it defaults
  * to recursively handling any `obj` that are `typeof 'object'` with no extra labeling or indenting of array elements
  * but adding such to any sub-objects found whenther they are found in a parent object or as an object that is an
  * element of an array.
  * Non-object array elements are encoded to escape any reserved HTML characters.
  * For everything else that doesn't have a custom transformation supplied it encodes the output to escape reserved HTML
  * characters. */
  const format: (meta: PropMeta, record: any, idx?: number) => string = (meta: PropMeta, record: any, idx?: number) => {
    const obj = idx ? record[meta.key][idx] : record[meta.key]
    if (!obj) return ''
    if (transforms?.[meta.key]) return transforms[meta.key](obj, record)
    if (nestingDefaultTypes.has(meta.type)) { // Recurse on sub-parts.
      if (meta.type === 'object') { // not array - iterate keys to recurse adding labels and indentation
        const objMetas = getMetaData(obj)
        return `
          <div style='padding-left: 0.4rem' class='sub-object'>
            ${objMetas.map(p => {
                return `<div><span style='text-transform: capitalize'>${p.key}: </span>${format(p, obj)}</div>`
              }).join('')
            }
          </div>`
      } else if (meta.type === 'array' && !idx) { // array - iterate elements to recurse
        return `
          <div style='padding-left: 0.4rem' class='sub-array'>
            ${obj.map((e: any) => {
                const eType = getType(e)
                return `<div>${format({ key: meta.key, type: eType, shouldNest: nestingDefaultTypes.has(eType) }, { [meta.key]: e })}</div>`
              }).join('')
            }
          </div>`
      } else if (meta.type === 'array') { // array element
        // return `Element: ${htmlEncode(obj)}`
        return ''
      }
    }
    // All other single-value types.
    return htmlEncode(obj)
  }

  const nestingKeys = new Set(nesting ? getNestingKeys(data) : [])
  const rowspanKeys = new Set(!nesting ? getRowspanKeys(data) : [])
  propsMetas = propsMetas ? sortByNesting(propsMetas) : sortByNesting(getMetaData(data[0]))

  const defaultMetas = getMetaData(data[0])
  const simpleMetas = propsMetas ? propsMetas.filter(h => !nestingDefaultTypes.has(h.type)) : []
  const plainMetas = propsMetas ? propsMetas.filter(h => !nestingKeys.has(h.key)) : []
  const subrowMetas = plainMetas ? plainMetas.filter(h => !rowspanKeys.has(h.key)) : []
  const nestedMetas = propsMetas ? propsMetas.filter(h => nestingKeys.has(h.key)) : []

  const longestKey = simpleMetas.reduce((a, b) => Math.max(a, b.key.length), 0) + 1 + 'ch'
  /*
  let tableRoot: HTMLElement
  $: tableRoot?.style.setProperty('--longest-key', longestKey)
  */
  const contextualizedData = spanning ? interpolateSpanning(data, defaultMetas.filter(h => !rowspanKeys.has(h.key))) : data

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
        data = data.sort((a, b) => { return a[meta.key]?.localeCompare(b[meta.key], undefined, { sensitivity: 'accent' }) })
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
    if (obj) {
      if (obj.length !== undefined) return obj.length > 0
      if (obj.size !== undefined) return obj.size > 0
    }
    return obj !== undefined
  }
</script>

{#if propsMetas && contextualizedData.length > 0 }
<div class:table-container={true}>
  <table style={`--longestKey: ${longestKey}`}>
    <slot name='caption' {contextualizedData}>
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
              on:click={() => { sortByHeading(plainHead) }}>{getHeadingText(plainHead.key)}
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
            on:click={() => { sortByHeading(nestedHead) }}>{getHeadingText(nestedHead.key)}
            <slot name='sortIcon' {ascending} {selectedHeading} key={nestedHead.key}>
              <span hidden={nestedHead.key !== selectedHeading} class:order-icon={true}>{@html ascending ? '&#9661;' : '&#9651;'}</span>
            </slot>
          </th>
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each contextualizedData as record, i}<!-- Note that `i` cannot be passed directly to slots. -->
        <slot name='record' {record} {propsMetas} {simpleMetas} {plainMetas} {nestedMetas} colspan={plainMetas.length ?? 1} {longestKey} {isBottomProp} {isAlternate} {dataPresent} {format}>
          {#if plainMetas.length}
            {#if !spanning || i === record[SpanningMetaSym].groupStartRecIdx}
              <tr class:opaqued={isAlternate(i)}
                class:group-opaqued={spanning && isAlternate(record[SpanningMetaSym].groupIdx)}
                class:bottom-record-row={isBottomProp(plainMetas[plainMetas.length - 1].key, record)}>
                <slot name='plainRowContent' {record} {plainMetas} {format}>
                  {#each plainMetas as dataMeta}
                    <td data-key={getHeadingText(dataMeta.key)}
                      rowspan={rowspanKeys.has(dataMeta.key) ? record[SpanningMetaSym].totalRowspan : 1}
                      class:complex-container={dataMeta.shouldNest}
                      class:simple-container={!dataMeta.shouldNest}>
                      <slot name='plainDataContent' {record} {dataMeta} {format}>
                        <!-- By default we spread array elements into seperate blocks nested in complex-container responsiveness block. -->
                        {#if dataMeta.type === 'array'}
                          <div class='complex-container array'>
                            <slot name='plainArrayContent' {record} {dataMeta} {format}>
                              {#each record[dataMeta.key] as element, idx}
                                  <slot name='plainArrayElementContent' {record} {dataMeta} {element} {format}>
                                    {@html format(dataMeta, record, idx)}
                                  </slot>
                              {/each}
                            </slot>
                          </div>
                        {:else}
                          <div class:complex-container={dataMeta.shouldNest}>
                            <slot name='plainSingletonContent' {record} {dataMeta} {format}>
                              {@html format(dataMeta, record)}
                            </slot>
                          </div>
                        {/if}
                      </slot>
                    </td>
                  {/each}
                </slot>
              </tr>
            {:else if i !== record[SpanningMetaSym].groupStartRecIdx} <!-- Sub-Records of the source record's group. -->
              <tr class:opaqued={isAlternate(i)}
                class:group-opaqued={isAlternate(record[SpanningMetaSym].groupIdx)}
                class:bottom-record-row={isBottomProp(plainMetas[plainMetas.length - 1].key, record)}>
                {#each subrowMetas as dataMeta, subIdx}
                  <td data-key={getHeadingText(dataMeta.key)}
                    class:complex-container={dataMeta.shouldNest}
                    class:simple-container={!dataMeta.shouldNest}>
                    <slot name='plainDataContent' {record} {dataMeta} {format}>
                      <!-- By default we spread array elements into seperate blocks nested in complex-container responsiveness block. -->
                      {#if dataMeta.type === 'array'}
                        <div class='complex-container array'>
                          <slot name='plainArrayContent' {record} {dataMeta} {format}>
                            {#each record[dataMeta.key] as element, idx}
                                <slot name='plainArrayElementContent' {record} {dataMeta} {element} {format}>
                                  {@html format(dataMeta, record, idx)}
                                </slot>
                            {/each}
                          </slot>
                        </div>
                      {:else}
                        <div class:complex-container={dataMeta.shouldNest}>
                          <slot name='plainSingletonContent' {record} {dataMeta} {format}>
                            {@html format(dataMeta, record)}
                          </slot>
                        </div>
                      {/if}
                    </slot>
                  </td>
                {/each}
              </tr>
            {/if}
          {/if}
          {#each nestedMetas as dataMeta}
            {#if dataPresent(record[dataMeta.key])}
              <slot name='nestedRows' {record} {nestedMetas} {dataMeta} colspan={plainMetas.length ?? 1} {isBottomProp} {isAlternate} {format}>
                <tr class:opaqued={isAlternate(i)}
                  class:group-opaqued={isAlternate(record[SpanningMetaSym].groupIdx)}
                  class:bottom-record-row={isBottomProp(dataMeta.key, record)}>
                  <slot name='nestedRowContent' {record} {dataMeta} colspan={plainMetas.length ?? 1} {format}>
                    <td data-key={getHeadingText(dataMeta.key)}
                      class:nested-container={true}
                      colspan={plainMetas.length ?? 1}>
                      <slot name='nestedDataContent' {record} {dataMeta} {format}>
                      <!-- By default we spread array elements into seperate blocks nested in complex-container responsiveness block. -->
                        {#if dataMeta.type === 'array'}
                          <div class='complex-container array'>
                            <slot name='nestedArrayContent' {record} {dataMeta} {format}>
                              {#each record[dataMeta.key] as element, idx}
                                <slot name='nestedArrayElementContent' {record} {dataMeta} {element} {format}>
                                  {@html format(dataMeta, record, idx)}
                                </slot>
                              {/each}
                            </slot>
                          </div>
                        {:else}
                          <div class:complex-container={dataMeta.shouldNest}>
                            <slot name='nestedSingletonContent' {record} {dataMeta} {format}>
                              {@html format(dataMeta, record)}
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
  No results found.
{/if}

<style>
  .bottom-heading-row {
    border-bottom: var(--dialog-container-border ,1px solid hsl(0 0% 0% / 0.6));
  }
  .bottom-record-row {
    border-bottom: 1px solid hsl(0 0% 0% / 0.2);
  }
  .opaqued:not(.group-opaqued) {
    background: hsl(0 0% 0% / 0.1); /* get the alpha version of var(--table-alternate-bg) */
  }
  .group-opaqued:not(.opaqued) {
    background: hsl(0 0% 0% / 0.1); /* get the alpha version of var(--table-alternate-bg) */
  }
  .opaqued.group-opaqued {
    background: hsl(0 0% 0% / 0.5);
  }
  .table-container {
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
    background: var(--table-header-bg, hsl(0 0% 0% / 0.5));
    color: var(--table-header-text);
    text-transform: capitalize;
    cursor: pointer;
  }
  th:not(:last-child) {
    border-right: var(--dialog-container-border);
  }
  th.nested-container {
    border-top: var(--dialog-container-border);
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
