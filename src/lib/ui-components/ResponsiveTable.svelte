<script lang=ts>
  /** A responsive table that will generate itself based on the `data` and behavior bindings passed to it. */

  /** Array of `Record<string, any>[]` records to generate a table for. Uses the first element to figure out the shape of the data. All
   * elements MUST be uniform with the first, or at least have values corresponding to the compatible properties in that first record. */
  export let data: Record<string, any>[]
  export let caption: string
  /** Whether to sort props with sub-props last for nesting on separate rows after all single value props have been displayed on a common row. */
  export let nestedLast: boolean = !true
  /** Pass in any special transfrom functions, keyed by the property names in your data, that generate html based on the element passed in. Only used
   * on data rows. Useful for turning data elements into hyperlinks or buttons in the table. */
  export let transforms: Record<string, (e: any) => any> = {}
  /** Pass in any special sort handling functions, keyed by the property names in your data. */
  export let sortings: Record<string, (a: any, b: any) => number> = {}

  interface PropMeta { key: string, type: string }
  type EnhancedTypes = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'

  const headingData = getMetaData(data[0])
  const incompatibleTypes = new Set(['undefined', 'function', 'symbol'])
  const arithmeticTypes = new Set(['number', 'bigint', 'boolean'])
  const nestingTypes = new Set(['object', 'array'])

  const plainHeadings = headingData.filter(h => !nestingTypes.has(h.type))
  const nestHeadings = headingData.filter(h => nestingTypes.has(h.type))

  /** Returns an array of { key, type } records that describe the properties of the `obj` that are compatible with display in this table. */
  function getMetaData (obj: any) {
    const keys = Object.keys(obj)
    const filtered = keys.reduce<PropMeta[]>((wanted, key) => {
      let type: EnhancedTypes = typeof obj[key]
      if (type === 'object' && obj[key].length !== undefined) type = 'array'
      if (!incompatibleTypes.has(type)) wanted.push({ key, type })
      return wanted
    }, [])
    /** Properties with arrays and objects at the bottom if `nestedLast` is desired . */
    const orderedKeys = !nestedLast
      ? filtered
      : filtered.sort((a, b) => {
        const aType = a.type === 'object' ? 1 : 0
        const bType = b.type === 'object' ? 1 : 0
        return aType - bType
      })
    return orderedKeys
  }

  let ascending = true
  let selectedHeading = ''
  /** Sorts `data` by the heading { key, type } data associated with the records in it. Array properties are sorted by their length.
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

  function opaqued (i: number) {
    return (i % 2) > 0
  }

  /** Formats `obj` based on any transformations passed for its associated heading type, OR calls JSON.stringify if typeof `object` and no transforms are defined.
   * Else it just returns the object value without altering it. */
  function format (meta: PropMeta, obj: any) {
    if (transforms[meta.key]) return transforms[meta.key](obj)
    else if (meta.type === 'object') return JSON.stringify(obj)
    return obj
  }

</script>

<div class='table-container'>
  <table>
    {#if caption}
    <caption>{caption}</caption>
    {/if}
    <thead>
      {#if nestedLast && nestHeadings.length > 0} <!-- Spreading record over multiple rows. -->
        <tr>
        {#each plainHeadings as plain}
          <th
            class:selected={plain.key === selectedHeading}
            aria-sort={plain.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
            on:click={() => { sortByHeading(plain) }}>{plain.key.replace('_', ' ')}
            <span hidden={plain.key !== selectedHeading} class='order-icon'>{@html ascending ? '&#9661;' : '&#9651;'}</span>
          </th>
        {/each}
        </tr>
        {#each nestHeadings as nested}
          <tr>
            <th
              colspan={plainHeadings.length ?? 1}
              class:selected={nested.key === selectedHeading}
              aria-sort={nested.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
              on:click={() => { sortByHeading(nested) }}>{nested.key.replace('_', ' ')}
              <span hidden={nested.key !== selectedHeading} class='order-icon'>{@html ascending ? '&#9661;' : '&#9651;'}</span>
            </th>
          </tr>
        {/each}
      {:else} <!-- No multi-row representation of record data. -->
        <tr>
        {#each headingData as heading}
          <th
            class:selected={heading.key === selectedHeading}
            aria-sort={heading.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
            on:click={() => { sortByHeading(heading) }}>{heading.key.replace('_', ' ')}
            {#if heading.key === selectedHeading}
            <span class='order-icon'>{@html ascending ? '&#9661;' : '&#9651;'}</span>
            {/if}
          </th>
        {/each}
        </tr>
      {/if}
    </thead>
    <tbody>
    {#each data as record, i}
      {#if nestedLast && nestHeadings.length > 0} <!-- Spreading record over multiple rows. -->
        <tr class:opaqued={opaqued(i)}>
        {#each plainHeadings as plain}
          <td data-cell={plain.key.replace('_', ' ')}>
            {@html format(plain, record[plain.key])}
          </td>
        {/each}
        </tr>
        {#each nestHeadings as nested}
        <tr class:opaqued={opaqued(i)}>
          {#if nested.type === 'array'}
            <td data-cell={nested.key.replace('_', ' ')}
              colspan={plainHeadings.length ?? 1}>
              <div class='array-container'>
              {#each record[nested.key] as element}
                <div>
                  {@html format(nested, element)}
                </div>
              {/each}
              </div>
            </td>
          {:else}
            <td data-cell={nested.key.replace('_', ' ')}
              colspan={plainHeadings.length ?? 1}>
              <div class='flex-container'>
                {@html format(nested, record[nested.key])}
              </div>
            </td>
          {/if}
        </tr>
        {/each}
      {:else} <!-- No multi-row representation of record data. -->
      <tr class:opaqued={opaqued(i)}>
      {#each headingData as plain}
        <td data-cell={plain.key.replace('_', ' ')}>
          {#if plain.type === 'array'}
            <div>
              {#each record[plain.key] as element}
              <div>
                {@html format(plain, element)}
              </div>
              {/each}
            </div>
          {:else}
            {@html format(plain, record[plain.key])}
          {/if}
        </td>
      {/each}
      </tr>
      {/if}
    {/each}
    </tbody>
  </table>
</div>

<style>
  .opaqued {
    background: hsl(0 0% 0% / 0.1);
  }
  .table-container {
    width: min(900px, 100% - 3rem);
    margin-inline: auto;
    overflow-x: auto;
  }
  .selected {
    font-weight: 700;
  }
  .flex-container {
    display: flex;
    flex-flow: row wrap;
    align-items: center;
    flex-basis: 4rem;
  }
  :global(.flex-container > *) {
    flex-grow: 1;
    padding: 0.3rem;
  }
  .array-container {
    column-count: 3;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  caption,th,td {
    padding: 1rem;
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
    td {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: 20ch auto;
      padding: 0.5rem, 1rem;
    }
    td:first-child {
      padding-top: 1.5rem;
    }
    td:last-child {
      padding-bottom: 1.5rem;
    }
    td::before {
      content: attr(data-cell) ': ';
      font-weight: 700;
      text-transform: capitalize;
    }
    .array-container {
      column-count: 2;
    }
  }
</style>
