
# Documentation - ResponsiveTable

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

## Slots

`ResponsiveTable` provides a lot of flexibility to customize how it renders through an offering of slots
from the most topical of concepts like the caption and sort ordering icon, to record level slots for full
control over how your records are displayed. Furthermore it allows fine tuned customization between its
[internal classifications](#internal-classifications) of `Plain` rows and `Nested` rows by providing
slotting drill downs for both classifications of: all nested rows, contents of rows, data content, arrays
content, and even array element content.

### Topical Slots

Control how your caption is rendered and what/how to render for your sorting indicators.

- ```ts
  "caption" {data}
  ```

  - Self explanatory.

- ```ts
  "sortIcon" {ascending} {selectedHeading} {key}
  ```

  - The `key` bound here is what data key is associated with the internal use of this slot.
    The `selectedHeading` is what heading was previously selected if any.
    Useful for `{selectedHeading === key}` tests to determine what icon to display for the [key]`.

### Record Slot

If what you're doing is simple enough that all you really want is the heading and sorting functionality
associated with it then you can handle the full data structuring yourself with the `"record"` slot to define
how each record's data will correspond to the heading columns. Everything `ResponsiveTable` uses to
generate the default structuring and styling is exposed for your use. Keep in mind though that the heading
will still generate according to the behavior binds you set and you will need to handle both its internal
concepts if `nesting` is activated and you have nestable data.

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
  - `format(meta, record[key], transforms)` will apply any custom formatting supplied in `transforms` or
    default to `ResponsiveTable`'s default formattings if not supplied.

### Internal Classifications

Otherwise `ResponsiveTable` will default to its own layout and formatting based on the `data` bound to it
with two primary classifications:

- `Plain` for data items that present well on a single line.
- `Nested` for data that's complex/deep/large enough to merit nesting onto its own row - per nestable prop -
   below the `Plain` data row when `nesting` is enabled.

### Plain Drill-Down Slots

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
  "plainDataAbsoluteContent" {record} {dataMeta} {format} {i}
  ```

  - Customize the html structure handling of `Plain` property values that aren't arrays.

### Nested Drill-Down Slots

The following slots are just like the above but only apply when `nesting` is enabled AND the property key
is marked as nestable. Bind `getNestingKeys(data)` to override the defaults with an array of the key names
you want nesting for.

- ```ts
  "nestedRows" {record} {nestedMeta} {dataMeta} {colspan} {isBottomProp} {isAlternate} {format} {i}
  ```

  - Because `nesting` causes muti-row presentation of records we can't use simple `tr:nth-child(even)`
    styling to differentiate between records so the `isAlternate(i)` function is exposed for you use in
    association with class assignments to style each nested record in alternation - `<tr class:opaqued={isAlternate(i)} ...>`
    Furthermore the `isBottomProp(key, record?)` function is exposed to determine if the property this slot
    is generating a nested row for is a bottom property of a record useful for differentiating between the
    bottom border of rows within a record and the bottom border of the last row of a record. You'll also need
    to set the `colspan` of nested record rows.
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
  "nestedDataAbsoluteContent" {record} {dataMeta} {format} {i}
  ```
