<script lang='ts' context='module'>
  import { getType, type EnhancedType, type SortParam } from '$lib/util/helpers.js'
  import { htmlEncode } from 'txstate-utils'
  const sIconChars = {
    asc: '&#9661;', // &#9661; ▲
    desc: '&#9651;', // &#9651; ▼
    none: '&#8693;' // &#8645;
  }

  const incompatibleTypes = new Set(['undefined', 'function', 'symbol'])
  const nestingDefaultTypes = new Set(['object', 'array'])
  const arithmeticTypes = new Set(['number', 'bigint', 'boolean'])

  export interface TableData extends Record<string, any> {}
  export interface PropMeta { key: string, type: EnhancedType, sortable?: boolean, shouldNest?: boolean }

  export interface GroupedMeta { groupIdx: number, rowspans: Record<string, number>, totalRowspan: number }
  export interface GroupedData { group: TableData[], grpMeta: GroupedMeta }

  export interface HeadingTexts extends Record<string, string> {}

  export type TransformFunction = (value: any, record: any) => string
  export interface Transforms extends Record<string, TransformFunction> {}

  export type SyncSortFunction = (a: any, b: any) => number
  export type AsyncSortFunction = (options: SortParam) => Promise<TableData[]>
  export interface Sortings extends Record<string, SyncSortFunction> {}
  export interface AsyncSortings extends Record<string, AsyncSortFunction> {}

  export interface ResponsiveTableProps {
    data: TableData[]
    propsMetas: PropMeta[] | undefined
    caption: string | undefined
    headingTexts: HeadingTexts | undefined
    transforms: Transforms | undefined
    sortings: Sortings | undefined
    nesting: boolean | undefined
    getNestingKeys: ((data: TableData[]) => string[]) | undefined
    spanning: boolean | undefined
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

  /** Returns an array of { key, type, shouldNest } records that describe the properties of the `obj`. */
  function getMetaData (obj: Record<string, any>) {
    return Object.keys(obj).reduce<PropMeta[]>((wanted, key) => {
      const type: EnhancedType = getType(obj[key])
      if (!incompatibleTypes.has(type)) {
        const shouldNest = nestingDefaultTypes.has(type)
        wanted.push({ key, type, shouldNest, sortable: true })
      }
      return wanted
    }, [])
  }

  /** Transforms `data` creating new records for each element found in the subproperty arrays of `data`'s records. The
   * arrays that this is performed for is limited by inclusion in the `subrowMetas: PropMeta[]` parameter.
   *
   * All records are clones of an original source record, minus the array being interpolated into the data but including that
   * array's corresponding element data. If we were running this on one record and interpolating an array property of that
   * record then that record would be transformed into a number of records equal to the length of that array with each
   * record returned being the equivalent of the rest (`...element`) expanded values of the array's corresponding element,
   * and the rest expansion of the source record's values minus the interpolated array.
   *
   * Since we're transforming records into multiple clones of their source record a means of conveniently tracking the new
   * record's context to the original record is provided by returning an array of `GroupedData` records each consisting of
   * a property `group` that is an array of the interpolated records generated from the source record of the group and an
   * additional property of `grpMeta` that includes rowspanning information. */
  function interpolateSpanning (data: any[], subrowMetas: PropMeta[]) {
    const groupItr = Object.values(data)
    const interpolated = subrowMetas.reduce((interpolate, meta) => {
      if (meta.type === 'array') {
        return interpolate.map((rec: any, idx: number) => {
          const rowspan = rec[meta.key].length
          const { [meta.key]: _, ...rest } = rec
          return rec[meta.key].map((element: any) => ({
            ...rest,
            ...element,
            [SpanningMetaSym]: {
              groupIdx: rest.groupIdx ?? idx,
              rowspans: {
                ...rest[SpanningMetaSym]?.rowspans,
                [meta.key]: rowspan
              }
            }
          }))
        }).flat()
      }
      return interpolate
    }, data)

    const groupedRecords = []
    for (let i = 0; i < interpolated.length;) {
      const group = []
      const grpSpanningMeta = interpolated[i][SpanningMetaSym]
      const grpIdx = grpSpanningMeta.groupIdx
      grpSpanningMeta.totalRowspan = Object.values<number>(grpSpanningMeta.rowspans).reduce<number>((acc, curr) => acc + curr, 0)
      while (interpolated[i]?.[SpanningMetaSym].groupIdx === grpIdx) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete interpolated[i][SpanningMetaSym]
        group.push(interpolated[i++])
      }
      groupedRecords.push({ group, grpMeta: grpSpanningMeta })
    }
    return groupedRecords as GroupedData[]
  }

</script>
<script lang='ts'>

  /* TODO:
    1) Add `rollupSize` option to resize rows that are `rollupSize` lines tall.
    2) ? Add hidden sort <select> with <asc|desc> button(?) that displays in mobile media mode.
      2 Addendum)
       The original sort approach here might not have been the way to go. It's great for sorting
       in page records that are fetched and displayed in the table but often times users will
       expect sorts to operate on the whole paginated set bringing the data not displayed up to
       the top of the displayed set.
       - ADDED optional `asyncSortings` that can await API sorting.
         With that as an option consumer pages can access paginator states and can have the
         async sorting callbacks combine paginator, table key, and other state information to
         handle sorting outside of the scope of the data handed to the table.
       - This async sort should become the default handling if provided but there should also be
         an option to provide in page sorting or both options for users who are experts in data
         analysis enough to recognise the value of different sorting granularities. This can be
         handled by the page through the asnyc sorting callback referencing user preferences.
    3) Cleanup nesting of complex-container vs simple-container css classes in generated table.
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
  export let asyncSortings: AsyncSortings = {}
  /** Pass in any heading renaming for your data properties. */
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

  /** Gets the client defined heading text for `key` if defined or defaults to the value of `key`. Replaces any `_` with ` `. */
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
  function format (meta: PropMeta, record: any, idx?: number): string {
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
      } else if (meta.type === 'array') { // array - iterate elements to recurse
        return `
          <div style='padding-left: 0.4rem' class='sub-array'>
            ${obj.map((e: any) => {
                const eType = getType(e)
                return `<div>${format({ key: meta.key, type: eType, shouldNest: nestingDefaultTypes.has(eType) }, { [meta.key]: e })}</div>`
              }).join('')
            }
          </div>`
      }
    }
    // All other simpleton types.
    if (/^(?:string|number|boolean)$/.test(typeof obj) || obj instanceof Date) return htmlEncode(obj as string | number | boolean | Date)
    return ''
  }

  const nestingKeys = new Set(nesting ? getNestingKeys(data) : [])
  const rowspanKeys = new Set(!nesting ? getRowspanKeys(data) : [])
  const defaultMetas = getMetaData(data[0])
  // Should I do the following onMount?
  const effectiveMetas = propsMetas
    ? nesting ? sortByNesting(propsMetas) : propsMetas
    : nesting ? sortByNesting(defaultMetas) : defaultMetas

  const simpleMetas = effectiveMetas ? effectiveMetas.filter(h => !nestingDefaultTypes.has(h.type)) : []
  const plainMetas = effectiveMetas ? effectiveMetas.filter(h => !nestingKeys.has(h.key)) : []
  const subrowMetas = plainMetas ? plainMetas.filter(h => !rowspanKeys.has(h.key)) : []
  const nestedMetas = effectiveMetas ? effectiveMetas.filter(h => nestingKeys.has(h.key)) : []

  const longestKey = simpleMetas.reduce((a, b) => Math.max(a, b.key.length), 0) + 1 + 'ch'

  $: groupedData = spanning ? interpolateSpanning(data, defaultMetas.filter(h => !rowspanKeys.has(h.key))) : []

  /** Sorts `meta` by meta.key exisiting in `nestingKeys` such that nestingKey values are at the end of `meta`. */
  function sortByNesting (meta: PropMeta[]) {
    return meta.sort((a, b) => { return Number(nestingKeys.has(a.key)) - Number(nestingKeys.has(b.key)) })
  }

  let ascending = true
  let selectedHeading = ''
  /** By default this sorts `data` by the heading `{ key, type }` data associated with the records in it. Array and object properties
   * are default sorted simply by their length. This also handles updating what heading is selected for soriting and toggling asc/desc.
   *
   * Default sorting methods can be overriden by the optional `sortings` bind which allows for associating the meta keys to a simple
   * `(a,b) => boolean` sort function or even `async` sorting functions that will return an entire replacement `data` set to be displayed
   * in the table - useful for sorting on the whole data set when only portions are given to the table to display in pagination schemes.
   * The async fuctions take a single `options` object parameter as defined by the exported `AsyncSortFunction` type. */
  async function sortByHeading (meta: PropMeta) {
    if (meta.key !== selectedHeading) { // Reset column state and resort.
      selectedHeading = meta.key
      ascending = true
      if (asyncSortings?.[meta.key]) {
        const sorter = asyncSortings[meta.key]
        data = await sorter({ field: meta.key, direction: 'asc' })
      } else if (sortings?.[meta.key]) {
        const sorter = sortings[meta.key]
        data = data.sort((a, b) => { return sorter(a[meta.key], b[meta.key]) })
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
      if (asyncSortings?.[meta.key]) {
        const sorter = asyncSortings[meta.key]
        data = await sorter({ field: meta.key, direction: ascending ? 'asc' : 'desc' })
      } else {
        data = data.reverse()
      }
    }
  }

  /** Utility function for detecting when we're working with the bottom property of a record.
   * If `record` is included it will check if any effectiveMetas props after `[key]:` have data
   * in the record and return true if `[key]:` is the last prop in `effectiveMetas` or everything
   * after `[key]:` is effectively empty in the record. Otherwise it next checks if there are any
   * `nestedMetas` in our state and returns true if not. Finally it checks if our `key` corresponds
   * to the last prop in `effectiveMetas` and returns true if so. Otherwise it returns false.
   * Useful for adding bottom of record formatting. */
  function isBottomProp (key: string, record?: any) {
    if (record) {
      return effectiveMetas.findIndex(p => p.key === key) >= effectiveMetas.findLastIndex(m => hasSubstance(record[m.key]))
    } else if (nestedMetas.length === 0) return true
    return effectiveMetas[effectiveMetas.length - 1].key === key
  }

  /** Recursively checks if `val` is not empty, nothing but spaces, or undefined/null. */
  function hasSubstance (val: any): boolean {
    return (
      val !== undefined && val !== null &&
      !(typeof val === 'string' && val.trim().length === 0) &&
      !(Array.isArray(val) && !val.some(hasSubstance)) &&
      !(typeof val === 'object' && !Object.values(val).some(hasSubstance))
    )
  }
</script>

{#if effectiveMetas && data.length }
<div class:table-container={true}>
  <table style={`--longestKey: ${longestKey}`}>
    <slot name='caption' contextualizedData={groupedData}>
      {#if caption}<caption>{caption}</caption>{/if}
    </slot>
    <thead>
      {#if plainMetas.length}
        <tr class:bottom-heading-row={nestedMetas.length === 0}>
          {#each plainMetas as plainHead}
            {#if plainHead.sortable}
              <th id={plainHead.key}
                aria-sort={plainHead.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}>
                <button class='sortable-column-header' on:click|preventDefault|stopPropagation={async () => await sortByHeading(plainHead)}>
                  {getHeadingText(plainHead.key)}
                  <slot name='sortIcons' {ascending} {selectedHeading} key={plainHead.key}>
                    <div hidden={plainHead.key !== selectedHeading} class='order-icon'>{@html ascending ? sIconChars.asc : sIconChars.desc}</div>
                    <div hidden={plainHead.key === selectedHeading} class='order-icon'>{@html sIconChars.none}</div>
                  </slot>
                </button>
              </th>
            {:else}
              <th id={plainHead.key} class='column-header' aria-sort='none'>{getHeadingText(plainHead.key)}</th>
            {/if}
          {/each}
        </tr>
      {/if}
      {#each nestedMetas as nestedHead}
        <tr class:bottom-heading-row={isBottomProp(nestedHead.key)}>
          {#if nestedHead.sortable}
            <th id={nestedHead.key}
              class:nested-container={true}
              colspan={plainMetas.length ? plainMetas.length : 1}
              aria-sort={nestedHead.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}>
              <button class='sortable-column-header' on:click|preventDefault|stopPropagation={async () => await sortByHeading(nestedHead)}>
                {getHeadingText(nestedHead.key)}
                <slot name='sortIcons' {ascending} {selectedHeading} key={nestedHead.key}>
                  <span hidden={nestedHead.key !== selectedHeading} class:order-icon={true}>{@html ascending ? sIconChars.asc : sIconChars.desc}</span>
                  <span hidden={nestedHead.key === selectedHeading} class='order-icon'>{@html sIconChars.none}</span>
                </slot>
              </button>
            </th>
          {:else}
            <th id={nestedHead.key} class:nested-container={true} class='column-header' aria-sort='none' colspan={plainMetas.length ? plainMetas.length : 1}>
              {getHeadingText(nestedHead.key)}
            </th>
          {/if}
        </tr>
      {/each}
    </thead>
    {#if (spanning && subrowMetas.length)} <!-- Possible multiple rows per record with subrow records spanned by source record data. -->
      {#each groupedData as recordGroup, gidx}
        <tbody>
          {#each recordGroup.group as record, ridx}
            {#if ridx === 0} <!-- First record in group. -->
              <tr>
                {#each effectiveMetas as dataMeta}
                  <td data-key={getHeadingText(dataMeta.key)} headers={dataMeta.key}
                    rowspan={rowspanKeys.has(dataMeta.key) ? recordGroup.grpMeta.totalRowspan : 1}
                    class:spansrows={rowspanKeys.has(dataMeta.key)}
                    class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
                    {#if dataMeta.type === 'array'}
                      <div class='complex-container array'>
                        {#each record[dataMeta.key] as element, idx}
                          {@html format(dataMeta, record, idx)}
                        {/each}
                      </div>
                    {:else}
                      <div class:complex-container={dataMeta.shouldNest}>
                        {@html format(dataMeta, record)}
                      </div>
                    {/if}
                  </td>
                {/each}
              </tr>
            {:else} <!-- Remaining records in group. -->
              <tr>
                {#each subrowMetas as dataMeta}
                  <td data-key={getHeadingText(dataMeta.key)} headers={dataMeta.key}
                    class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
                    {#if dataMeta.type === 'array'}
                      <div class='complex-container array'>
                        {#each record[dataMeta.key] as element, idx}
                          {@html format(dataMeta, record, idx)}
                        {/each}
                      </div>
                    {:else}
                      <div class:complex-container={dataMeta.shouldNest}>
                        {@html format(dataMeta, record)}
                      </div>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/if}
          {/each}
        </tbody>
      {/each}
    {:else if (nesting && nestedMetas.length)} <!-- Possibly multiple rows per record with subrow records spaning width of row. -->
      {#each data as record, idx}
        <tbody>
          <tr>
            {#each plainMetas as dataMeta}
              <td data-key={getHeadingText(dataMeta.key)} headers={dataMeta.key}
                class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
                {#if dataMeta.type === 'array'}
                  <div class='complex-container array'>
                    {#each record[dataMeta.key] as element, idx}
                      {@html format(dataMeta, record, idx)}
                    {/each}
                  </div>
                {:else}
                  <div class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
                    {@html format(dataMeta, record)}
                  </div>
                {/if}
              </td>
            {/each}
          </tr>
          {#each nestedMetas as dataMeta}
            <tr>
              <td data-key={getHeadingText(dataMeta.key)} headers={dataMeta.key}
                colspan={plainMetas.length ? plainMetas.length : 1}
                class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
                {#if dataMeta.type === 'array'}
                  <div class='complex-container array'>
                    {#each record[dataMeta.key] as element, idx}
                      {@html format(dataMeta, record, idx)}
                    {/each}
                  </div>
                {:else}
                  <div class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
                    {@html format(dataMeta, record)}
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      {/each}
    {:else} <!-- No grouping of records. All values of record are on one single row. -->
      {#each data as record, i}<!-- Note that `i` cannot be passed directly to slots. -->
        <tr>
          {#each effectiveMetas as dataMeta}
            <td data-key={getHeadingText(dataMeta.key)} headers={dataMeta.key}
                class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
              <!-- By default we spread array elements into seperate blocks nested in complex-container responsiveness block. -->
              {#if dataMeta.type === 'array'}
                <div class='complex-container array'>
                    {#each record[dataMeta.key] as element, idx}
                      {@html format(dataMeta, record, idx)}
                    {/each}
                </div>
              {:else}
                <div class={dataMeta.shouldNest ? 'complex-container' : 'simple-container'}>
                  {@html format(dataMeta, record)}
                </div>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    {/if}
  </table>
</div>
{:else}
  No results found.
{/if}

<style>
  .sortable-column-header {
    display: flex;
    flex-direction: row;
    /* justify-content: space-between; */
    align-items: center;
    cursor: pointer;
    text-transform: capitalize;
    border: none;
    background: none;
    padding: 0rem;
    color: var(--table-header-text);
    font-size: inherit;
  }
  .column-header {
    padding-top: 0.5rem;
    align-items: center;
    text-transform: capitalize;
    color: var(--table-header-text);
    font-size: inherit;
  }
  .bottom-heading-row {
    border-bottom: var(--dialog-container-border ,1px solid hsl(0 0% 0% / 0.6));
  }
  tbody {
    border-bottom: 1px solid hsl(0 0% 0% / 0.2);
  }
  tbody:nth-child(odd) {
    background: hsl(0 0% 0% / 0.1); /* get the alpha version of var(--table-alternate-bg) */

  }
  tbody > tr:only-child > td {
    padding-bottom: 1rem;
  }
  .table-container {
    margin-inline: auto;
    overflow-x: auto;
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
    border-spacing: 0.2rem;
  }
  caption,th,td {
    padding: 0.3rem;
    margin: 0.2rem;
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
    position: sticky;
    top: 0;
    overflow: auto;
    min-width: min-content;
  }
  th:not(:last-child) {
    border-right: var(--dialog-container-border);
    resize: horizontal;
    padding-right: 0.2rem;
  }
  th.nested-container {
    border-top: var(--dialog-container-border);
  }
  tr {
    vertical-align: center;
  }
  :not(tbody) > tr {
    vertical-align: top;
  }
  :not(tbody) > tr:nth-child(odd) {
    background: hsl(0 0% 0% / 0.1); /* get the alpha version of var(--table-alternate-bg) */
  }
  .spansrows {
    vertical-align: top;
  }
  td:not(.spansrows) {
    border-bottom: 1px solid hsl(0 0% 0% / 0.1);
  }
  tbody > tr:last-child > td:not(.spansrows) {
    border-bottom: inherit;
  }
  @media (max-width: 650px) {
    th {
      display: none;
    }
    tr,td {
      border: none !important;
    }
    tbody > tr {
      border-bottom: 1px solid hsl(0 0% 0% / 0.2);
    }
    div.simple-container {
      padding-left: 0.7rem;
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
      padding-top: 0.2rem;
    }
    td:last-child {
      padding-bottom: 0.2rem;
    }
    td::before {
      content: attr(data-key) ':';
      font-weight: 630;
      text-transform: capitalize;
    }
  }
</style>
