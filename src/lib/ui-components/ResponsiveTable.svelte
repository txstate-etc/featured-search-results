<script lang=ts>
  /** A responsive table that will generate itself based on the `data` and behavior parameters passed to it. */

  /* TODO: Add a custom sorting mapping similar to transforms that allows a custom sort algorithm to be used.
           - When done make sure to add a check to sortableTypes to include. Perhaps replace sortableTypes with sortable
             fields.
   */

  interface PropMeta { key: string, type: string }
  type EnhancedTypes = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'array'
  const incompatibleTypes = new Set(['undefined', 'function', 'symbol'])
  const arithmeticTypes = new Set(['number', 'bigint', 'boolean'])
  const sortableTypes = new Set([...arithmeticTypes, 'string', 'array'])
  const nestingTypes = new Set(['object', 'array'])

  /** Array of `Record<string, any>[]` records to generate a table for. Uses the first element to figure out the shape of the data. All
   * elements MUST be uniform with the first, or at least have values corresponding to the compatible properties in that first record. */
  export let data: Record<string, any>[]
  export let caption: string
  /** Whether to sort props with sub-props last for nesting on separate rows after all single value props have been displayed on a common row. */
  export let nestedLast: boolean = false
  /** Pass in any special transfrom functions, keyed by the properties in your data, that generate html based on the element passed in. Only used
   * on data rows. Useful for turning data elements into hyperlinks or buttons in the table. */
  export let transforms: Record<string, (e: any) => any> = {}

  const headingData = getMetaData(data[0])
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
  function sortByHeading (heading: PropMeta) {
    if (heading.key !== selectedHeading) { // Reset column state and resort.
      selectedHeading = heading.key
      ascending = true
      if (arithmeticTypes.has(heading.type)) {
        data = data.sort((a, b) => { return a[heading.key] - b[heading.key] })
      } else if (heading.type === 'string') {
        data = data.sort((a, b) => { return a[heading.key].localeCompare(b[heading.key], undefined, { sensitivity: 'accent' }) })
      } else { // Sort by length of each array.
        data = data.sort((a, b) => { return a[heading.key].length - b[heading.key].length })
      }
    } else {
      ascending = !ascending
      data = data.reverse()
    }
  }

  function opaqued (i: number) {
    return (i % 2) > 0
  }

  function format (heading: PropMeta, obj: any) {
    if (transforms[heading.key]) return transforms[heading.key](obj)
    else if (heading.type === 'object') return JSON.stringify(obj)
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
          {#if sortableTypes.has(plain.type)}
          <th
            class:sortable={true}
            class:selected={plain.key === selectedHeading}
            aria-sort={plain.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
            on:click={() => { sortByHeading(plain) }}>{plain.key.replace('_', ' ')}
            {#if plain.key === selectedHeading}
            <span class='order-icon'>{@html ascending ? '&#9661;' : '&#9651;'}</span>
            {/if}
          </th>
          {:else}
          <th>{plain.key.replace('_', ' ')}</th>
          {/if}
        {/each}
        </tr>
        {#each nestHeadings as nested}
          <tr>
          {#if sortableTypes.has(nested.type)}
          <th
            colspan={plainHeadings.length ?? 1}
            class:sortable={true}
            class:selected={nested.key === selectedHeading}
            aria-sort={nested.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
            on:click={() => { sortByHeading(nested) }}>{nested.key.replace('_', ' ')}
            {#if nested.key === selectedHeading}
            <span class='order-icon'>{@html ascending ? '&#9661;' : '&#9651;'}</span>
            {/if}
          </th>
          {:else}
          <th colspan={plainHeadings.length ?? 1}>{nested.key.replace('_', ' ')}</th>
          {/if}
          </tr>
        {/each}
      {:else} <!-- No multi-row representation of record data. -->
        <tr>
        {#each headingData as heading}
          {#if sortableTypes.has(heading.type)}
          <th
            class:sortable={true}
            class:selected={heading.key === selectedHeading}
            aria-sort={heading.key !== selectedHeading ? 'none' : (ascending) ? 'ascending' : 'descending'}
            on:click={() => { sortByHeading(heading) }}>{heading.key.replace('_', ' ')}
            {#if heading.key === selectedHeading}
            <span class='order-icon'>{@html ascending ? '&#9661;' : '&#9651;'}</span>
            {/if}
          </th>
          {:else}
          <th>{heading.key.replace('_', ' ')}</th>
          {/if}
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
              <div class='flex-container'>
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
  .sortable {
    cursor: pointer;
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
  }
  th {
    background: hsl(0 0% 0% / 0.5);
    text-transform: capitalize;
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
  }
</style>
