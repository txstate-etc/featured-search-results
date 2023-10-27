<script lang='ts' context='module'>
  /** Documentation - Temp placement here, will move to appropriate README.md
  A responsive table that will generate itself based on the `data` and behavior bindings passed to it.
  For data input where types can't be inferred from undefined data properties, you can define your own
  meta data description of what you want and bind them to propsMetas using this
  format:
  ```ts
  type EnhancedTypes = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'
  interface PropMeta {
    key: string, type: EnhancedTypes,
    // Whether this property's data is complex/deep/large enough to merit being displayed
    // inside an "extra responsive" container that will spread the contents accross inner
    // columns - space available - and provide special layout handling when presented in
    // smaller media sizes.
    isComplex: boolean
  }
  ```
  If what you're doing is simple enough that all you really want is the heading and sorting functionality
  associated with it then you can handle the full data structuring yourself with the `"record"` slot to define
  how each record's data will correspond to the heading columns. Everything `ResponsiveTable` uses to
  generate the default structuring and styling is exposed for your use.
  - ```ts
    "record" {record} {i} {propsMetas} {simpleMetas} {plainMetas} {nestedMetas}
             {colspan} {longestKey}
             {isBottomProp} {isAlternate} {dataPresent} {format}
    ```
    - `record` and `i` correspond to the record and its index value in the `data`.
    - `propsMetas` is the list of all the data's property metadata. You might have specified this yourself
      or let ResponsiveTable figure it out for you.
    - `simpleMetas` is a convenience reference to properties that `ResponsiveTable` is confident should be
      easy to display regardless of any consumer overrides.
    - `plainMetas` and `nestedMetas` are only relevant when `nesting` is enabled. See the following section.
    - `colspan` is the number of columns presented in the heading. Useful for spanning records across
      multiple rows.
    - `longestKey` is the character length of the longest key name. Useful for reserving inline label space.
    - `isBottomProp(key, record?)` is a convenience function useful for conditionally formatting the bottom
      border of a record's last row if it spans multiple rows.
    - `isAlternate(i)` is a convenience function for determining even indexes of records. Useful for applying
      alternating stylings - by record - with records that span multiple rows.
    - `dataPresent(record[key])` is a convenience function for determining if there's actually anything to
      display. Empty arrays, objects, and undefined properties return false.
    - `format(meta, record[key])` will apply any custom formatting supplied in the `transforms` bind defaulting
      to `ResponsiveTable`'s default formattings if not defined.

  Otherwise `ResponsiveTable` will default to its own layout and formatting based on the `data` bound to it
  with two primary classifications:
  - `Plain` for data items that present well on a single line.
  - `Nested` for data that's complex/deep/large enough to merit nesting onto its own row - per nestable prop -
     below the `Plain` data row when `nesting` is enabled.

  You can also define customizations to how it structures most of its parts using the following slot mappings:
  - ```ts
    "caption" {data}
    ```
    - Self explanatory.
  - ```ts
    "sortIcon" {ascending} {selectedHeading} {key}
    ```
    - The `key` bound here is what data key is associated with the internal use of this slot.
      The `selectedHeading` is what heading was previously selected if any.
      Useful for `{selectedHeading === key}` tests to determine what icon to display for `heading[key]`.

  The following slots apply to all records when `nesting` is disabled and to property values that don't
  require nesting when `nesting` IS enabled:
  - ```ts
    "plainRowContent" {record} {plainMetas} {format} {i}
    ```
    - Customize the full contents of `Plain` rows. To help make sure your `<td>`s match up the `plainMetas`
      describing all the items that need to be accounted for can be inspected. In addition a reference to
      the `format(obj)` handler is passed as well as the `i`ndex of the record in the `data` set. The number
      of columns defined in the table heading is equal to `plainMetas.length ?? 1` - in case you're off mark.
  - ```ts
    "plainDataContent" {record} {dataMeta} {format} {i}
    ```
    - Customize the handling of each `Plain` `<td>`'s content. `record[dataMeta.key]` is the property value to
      structure as desired.
  - ```ts
    "plainDataArrayContent" {record} {dataMeta} {format} {i}
    ```
    - Customize just the html structuring of `Plain` data arrays. Content slotted here will be in an extra
      responsive container. Go ahead and try recursively nesting another `<ResponsiveTable>` here. The
      `record[dataMeta.key]` exposed here would be the array. By default arrays are nested when `nesting`
      is enabled but this can be overridden by binding a function to `getNestingKeys(data)` that returns an
      array of data keys that exclude your desired array.
  - ```ts
    "plainDataArrayElementContent" {record} {dataMeta} {format} {element} {i}
    ```
    - Customize just the html structuring of each `Plain` array `element`.
  - ```ts
    "plainDataSimpleContent" {record} {dataMeta} {format} {i}
    ```
    - Customize the html structure handling of `Plain` property values that aren't arrays.

  The following slots are just like the above but only apply when `nesting` is enabled AND the property key
  is marked as nestable. Bind `getNestingKeys(data)` to override the defaults with an array of the key names
  you want nesting for.
  - ```ts
    "nestedRows" {record} {nestedMeta} {dataMeta} {colspan} {isBottomProp} {isAlternate} {format} {i}
    ```
    - Because `nesting` causes muti-row presentation of records we can't use simple `tr:nth-child(even)`
      styling to differentiate between records so the `isAlternate(i)` function is exposed for you use in
      association with class assignments to style each nested record in alternation - `<tr class:opaqued={isAlternate(i)} `...
      Furthermore the `isBottomProp` function is exposed to determine if the property this slot is generating a
      nested row for is a bottom property of a record useful for differentiating between the bottom border of
      rows within a record and the bottom border of the last row of a record. You'll also need to set the
      `colspan` of nested record rows. You can use `plainMetas.length ?? 1` to determine that value.
    - `nestedMeta` is provided for length inspection to forgo any unnessary content generation.
  - ```ts
    "nestedRowContent" {record} {dataMeta} {colspan} {format} {i}
    ```
    - Since this is for customizing the `<td>` that spans the entire row `colspan` is provided as a convenience.
  - ```ts
    "nestedDataContent" {record} {dataMeta} {format} {i}
    ```
  - ```ts
    "nestedDataArrayContent" {record} {dataMeta} {format} {i}
    ```
  - ```ts
    "nestedDataArrayElementContent" {record} {dataMeta} {element} {format} {i}
    ```
  - ```ts
    "nestedDataSimpleContent" {record} {dataMeta} {format} {i}
    ```
   */
  export const documentation = 'intellisense-mouseover'
  const incompatibleTypes = new Set(['undefined', 'function', 'symbol'])
  const nestingDefaultTypes = new Set(['object', 'array'])
  const arithmeticTypes = new Set(['number', 'bigint', 'boolean'])

  /** `typeof` operator doesn't distinguish between 'object' and 'array' and we want the distinction here. */
  type EnhancedTypes = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'
  export interface PropMeta { key: string, type: EnhancedTypes, isComplex: boolean }

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
  export let caption: string
  /** Whether to sort nestable props to the end of the record and nest them on their own rows after all "simple" value props have been displayed on a common row. */
  export let nesting: boolean = !true
  /** Pass in any special transfrom functions, keyed by the property names in your data, that generate html based on the element passed in. Only used
   * on data rows. Useful for turning data elements into hyperlinks or buttons in the table. */
  export let transforms: Record<string, (e: any) => string> = {}
  /** Pass in any special sort handling functions, keyed by the property names in your data. */
  export let sortings: Record<string, (a: any, b: any) => number> = {}
  /** Optional function bind to return an array of property names to nest on their own row.
   * Useful for overriding default behavior of doing so for all objects and arrays when `nesting` is enabled. */
  export let getNestingKeys: (data: Record<string, any>[]) => string[] = (data: Record<string, any>[]) => {
    const meta = getMetaData(data[0])
    return meta.filter(m => nestingDefaultTypes.has(m.type)).map(m => m.key)
  }
  /** Rather than let `ResponsiveTable` generate the default metadata definitions its using to drive its output
   * you can supply your own metadata descriptor via this bind.
   * @note Will have an a value of `undefined` until the table is mounted/initialized. */
  export let propsMetas: PropMeta[]
  propsMetas = propsMetas ? sortByNesting(propsMetas) : sortByNesting(getMetaData(data[0]))

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
  /** Sorts `data` by the heading { key, type } data associated with the records in it.
   * Also handles updating what heading is selected for soriting and toggling asc/desc. */
  function sortByHeading (meta: PropMeta) {
    if (meta.key !== selectedHeading) { // Reset column state and resort.
      selectedHeading = meta.key
      ascending = true
      if (sortings[meta.key]) {
        data = data.sort((a, b) => { return sortings[meta.key](a[meta.key], b[meta.key]) })
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
    return propsMetas[0].key === key
  }
  /** Utility function for detecting when we're working with the bottom property of a record.
   *  If `record` is included it will check if any props of record after `key` have data and
   *  return true if everything after `key` is effectively empty. Useful for adding bottom of
   *  record formatting. */
  function isBottomProp (key: string, record?: any) {
    if (record) {
      return propsMetas.findIndex(p => p.key === key) >= propsMetas.findLastIndex(l => dataPresent(record[l.key]))
    } else if (nestedMetas.length === 0) return true
    return propsMetas[propsMetas.length - 1].key === key
  }

  /** Formats `obj` based on any transformations passed for its associated heading type, OR calls JSON.stringify if typeof `object` and no transforms are defined.
   * Else it just returns the object value without altering it. */
  function format (meta: PropMeta, obj: any) {
    if (transforms[meta.key]) return transforms[meta.key](obj)
    else if (meta.type === 'object') return JSON.stringify(obj)
    return obj
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
      {#each data as record, i}
        <slot name='record' {record} {propsMetas} {simpleMetas} {plainMetas} {nestedMetas} colspan={plainMetas.length ?? 1} {longestKey} {isBottomProp} {isAlternate} {dataPresent} {format} {i}>
          {#if plainMetas.length}
            <tr class:opaqued={isAlternate(i)}
              class:bottom-record-row={isBottomProp(plainMetas[plainMetas.length - 1].key, record)}>
              <slot name='plainRowContent' {record} {plainMetas} {format} {i}>
                {#each plainMetas as dataMeta}
                  <td data-key={dataMeta.key.replace('_', ' ')}
                    class:complex-container={dataMeta.isComplex}
                    class:simple-container={!dataMeta.isComplex}>
                    <slot name='plainDataContent' {record} {dataMeta} {format} {i}>
                      {#if dataMeta.type === 'array'}
                        <div class:complex-container={true}>
                          <slot name='plainDataArrayContent' {record} {dataMeta} {format} {i}>
                            {#each record[dataMeta.key] as element}
                              <slot name='plainDataArrayElementContent' {record} {dataMeta} {element} {format} {i}>
                                {@html format(dataMeta, element)}
                              </slot>
                            {/each}
                          </slot>
                        </div>
                      {:else}
                        <div
                          class:complex-container={dataMeta.isComplex}
                          class:simple-container={!dataMeta.isComplex}>
                          <slot name='plainDataSimpleContent' {record} {dataMeta} {format} {i}>
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
              <slot name='nestedRows' {record} {nestedMetas} {dataMeta} colspan={plainMetas.length ?? 1} {isBottomProp} {isAlternate} {format} {i}>
                <tr class:opaqued={isAlternate(i)}
                  class:bottom-record-row={isBottomProp(dataMeta.key, record)}>
                  <slot name='nestedRowContent' {record} {dataMeta} colspan={plainMetas.length ?? 1} {format} {i}>
                    <td data-key={dataMeta.key.replace('_', ' ')}
                      class:nested-container={true}
                      colspan={plainMetas.length ?? 1}>
                      <slot name='nestedDataContent' {record} {dataMeta} {format} {i}>
                        {#if dataMeta.type === 'array'}
                          <div class:complex-container={true}>
                            <slot name='nestedDataArrayContent' {record} {dataMeta} {format} {i}>
                              {#each record[dataMeta.key] as element}
                                <slot name='nestedDataArrayElementContent' {record} {dataMeta} {element} {format} {i}>
                                  {@html format(dataMeta, element)}
                                </slot>
                              {/each}
                            </slot>
                          </div>
                        {:else}
                          <div
                            class:complex-container={dataMeta.isComplex}>
                            <slot name='nestedDataSimpleContent' {record} {dataMeta} {format} {i}>
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
