<script lang=ts>
  import { getResultsDef } from '$lib/models/result'
  import { getQueriesDef } from '$lib/models/query'
  const resultsDef = getResultsDef()
  const queriesDef = getQueriesDef()
  // The following Alias records are for displaying purposes since SearchMappings can be counterintuitive to read from a front end context.
  const resultAliases: Record<string, string> = {
    title: 'title',
    pagename: 'title',
    'page name': 'title',
    tag: 'tags',
    tags: 'tags',
    tagcount: 'tags.length',
    'tag count': 'tags.length',
    url: 'url',
    path: 'url',
    domain: 'url',
    subdomain: 'url',
    hostname: 'url',
    broken: 'currency.broken',
    brokensince: 'currency.brokensince',
    duplicateurl: 'currency.conflictingUrls.url',
    duplicateurls: 'currency.conflictingUrls.length',
    duplicatetitle: 'currency.conflictingTitles.title',
    duplicatetitles: 'currency.conflictingTitles.length',
    duplicatematch: 'currency.conflictingMatchings.mode',
    duplicatematches: 'currency.conflictingMatchings.length',
    matchwords: 'entries.keywords',
    'match words': 'entries.keywords',
    matchwordcount: 'entries.keywords.length',
    'matchword count': 'entries.keywords.length',
    keyphrase: 'entries.keywords',
    aliases: 'entries.keywords',
    keyword: 'entries.keywords',
    keywords: 'entries.keywords',
    keywordcount: 'entries.keywords.length',
    'keyword count': 'entries.keywords.length',
    search: 'entries.keywords',
    query: 'entries.keywords',
    term: 'entries.keywords',
    terms: 'entries.keywords',
    termcount: 'entries.keywords.length',
    'term count': 'entries.keywords.length',
    mode: 'entries.mode',
    type: 'entries.mode',
    priority: 'entries.priority',
    weight: 'entries.priority',
    hits: 'entries.hitCountCached',
    count: 'entries.hitCountCached'
  }
  const queryAliases: Record<string, string> = {
    'match words': 'query',
    keyphrase: 'query',
    aliases: 'query',
    keywords: 'query',
    query: 'query',
    search: 'query',
    term: 'query',
    terms: 'query',
    title: 'results.title',
    pagename: 'results.title',
    'page name': 'results.title',
    url: 'results.url',
    path: 'results.url',
    domain: 'results.url',
    subdomain: 'results.url',
    hostname: 'results.url',
    hits: 'hitcount',
    count: 'hitcount',
    hitcount: 'hitcount',
    lasthit: 'lasthit',
    'last hit': 'lasthit',
    resultcount: 'results.length',
    'result count': 'results.length'
  }
  function getMismatches (display: Record<string, string>, mapping: Record<string, string>): undefined | Record<'notInDisplay' | 'notInMapping', string[]> {
    const notInMapping = []
    const notInDisplay = []
    for (const key in display) {
      if (!mapping[key]) {
        notInMapping.push(key)
      }
    }
    for (const key in mapping) {
      if (!display[key]) {
        notInDisplay.push(key)
      }
    }
    return (notInMapping.length || notInDisplay.length) ? { notInDisplay, notInMapping } : undefined
  }
  const resultMismatches = getMismatches(resultAliases, resultsDef.aliasMap)
  const queryMismatches = getMismatches(queryAliases, queriesDef.aliasMap)
</script>

<h1 id="admin---advanced-searching-syntax">Admin - Advanced Searching Syntax</h1>
<h2 id="admin---overview">Overview</h2>
<p>The search dialogs in the Admin app allow for either simple searches or advanced searches. Normally if you type a simple bit of text into the search bar and search on it then the default fields associated with that search will be searched against using every spaces separated word you typed in the search bar - with the caveat that you can enclose groups of words with quotes to group them together.</p>
<p>Advanced search triggers on your search <strong>WHEN</strong> you specify one of the keyword aliases in combination with one of the search type operators , OR include one of the intersection or negation operators before a simple search or keyword + operator search. <span class='warning'>WARNING: If you try to form an advanced search but don't spell one of the keywords or operators correctly then the search will run as a simple search against every individual word of your attempted advanced search (quotes caveat in play) - which will most likely lead to results being found that don't jive with what you expected.</span></p>
<p>Where:</p>
<ul><!-- MetaSyntax Defintions -->
  <li><code><strong>bold text</strong></code> <i><span class='terminator'>- are keywords or search options.</span></i></li>
  <li><code><i>italic text</i></code> <i><span class='terminator'>- are variable items.</span></i></li>
  <li><code><span class='synOp'>[</span>optional<span class='synOp'>]</span></code> <i><span class='terminator'>- syntax components displayed in square brackets are <u>optional</u>.</span></i></li>
  <li><code><span class='synOp'>&lcub;</span>x<span class='synOp'>|</span>y<span class='synOp'>|</span>z<span class='synOp'>&rcub;</span></code> <i><span class='terminator'>- choices of <u>required</u> syntax components separated by <code><span class='synOp'>|</span></code> are in curly brackets.</span></i></li>
  <li><code><span class='descriptor'>&lt;descriptor&gt;</span></code> <i><span class='terminator'>- non syntax reference enclosures for referencing general syntax structures are in angle brackets.</span></i></li>
  <li><code><span class='terminator'>...</span></code> <i><span class='terminator'>- means the previous syntax structure or framed reference is repeatable.</span></i></li>
</ul>
<p>Generally the syntax structure goes something like this:</p>
<ul><!-- Syntax Structures -->
  <li><!-- Compound Search -->
    <code><span class='descriptor'>&lt;compound search&gt;</span> = <span class='synOp'>[&lcub;</span><span class='descriptor'>&lt;search phrase&gt;</span><span class='synOp'>&lcub;</span><span class='terminator'>,</span><span class='synOp'>|</span><span class='terminator'>;</span><span class='synOp'>|</span><span class='descriptor'><span class='terminator'>&lt;spaces&gt;</span></span><span class='synOp'>&rcub;&rcub;</span><span class='terminator'>...</span><span class='synOp'>]</span></code>
    <blockquote>
      <p>You can combine multiple searches into a single compound search. In fact, simple searches with multiple words are compound searches of each word against the default fields of the search subject. You can even mix simple search phrases with advanced searches that will trigger on any set of search phrasing in the search that corresponds to an advanced search phrase.</p>
      <p>By default all searches in a compound search will union the results that match each search into a combined set - this is antithetical to normal search engine narrowing of search matches based on the more terms you provide but you can use the intersection flags described below to make parts of a compound search required for all matching and thus narrow the matching results to only results that match that part of the search phrase <span class='terminator'>AND</span> any other search qualifiers.</p>
    </blockquote>
  </li>
  <li><!-- Search Phrase -->
    <code><span class='descriptor'>&lt;search phrase&gt;</span> = <span class='synOp'>[</span><span class='intNeg'>&lt;intersection or negation flags&gt;</span><span class='synOp'>]</span> <span class='synOp'>[</span><span class='keyword'>&lt;keyword&gt;</span> <span class='searchOp'>&lt;search type operator&gt;</span><span class='synOp'>]</span> <span class='whatfor'>&lt;text or values to search for&gt;</span></code>
    <blockquote>
      <p>There's optional spacing between a keyword and search type operator as well as that operator and what to search for. Most search operators are math like symbols but some are English participles and so spacing is needed to differentiate the operator from the keyword and search term.</p>
      <p>Note that what to search for is the only non-optional part of a search phrase - and thus the search is considered a simple search - but if you include a keyword you also need to provide an operator to determine how it's used for the search to be treated as a keyword advanced search. If you exclude the keyword portion of a search phrase the search comparison will search for what you want to search for against multiple default keywords using the default search operators only modified by any inclusion of intersection or negation flags.</p>
    </blockquote>
  <li><!-- Intersection or Negation Flags -->
    <code><span class='intNeg'>&lt;intersection or negation flags&gt;</span> = <span class='synOp'>&lcub;&lcub;</span><span class='intNeg'>+</span><span class='synOp'>|</span><span class='intNeg'>and</span><span class='synOp'>&rcub;|&lcub;</span><span class='intNeg'>-</span><span class='synOp'>|</span><span class='intNeg'>not</span><span class='synOp'>&rcub;&rcub;</span></code>
    <blockquote>
      <p>The default behavior for search is to match any of the search phrases - a logical <code><strong>OR</strong></code>. In contrast, using <code><span class='intNeg'>+</span></code> or <code><span class='intNeg'>and</span></code> means the following search phrase expression must be a part of the match in addition to any other matching conditions found - where the respective search phrase's result set intersects with the other search phrases' result sets rather than the default unioning of result sets together.</p>
      <p>While obvious in what it means for the search phrase, <u>negation</u> currently <u>cannot</u> be combined with <u>intersection</u>. </p>
    </blockquote>
  </li>
  <li><!-- Search Type Operators -->
    <code><span class='searchOp'>&lt;search type operator&gt;</span> = <span class='synOp'>&lcub;</span><span class='searchOp'>:</span><span class='synOp'>|</span><span class='searchOp'>=</span><span class='synOp'>|</span><span class='searchOp'>is</span><span class='synOp'>|</span><span class='searchOp'>contains</span><span class='synOp'>|</span><span class='searchOp'>includes</span><span class='synOp'>|</span><span class='searchOp'>&lt;</span><span class='synOp'>|</span><span class='searchOp'>&lt;=</span><span class='synOp'>|</span><span class='searchOp'>beginswith</span><span class='synOp'>|</span><span class='searchOp'>begins with</span><span class='synOp'>|</span><span class='searchOp'>starts with</span><span class='synOp'>|</span><span class='searchOp'>startswith</span><span class='synOp'>|</span><span class='searchOp'>&gt;</span><span class='synOp'>|</span><span class='searchOp'>&gt;=</span><span class='synOp'>|</span><span class='searchOp'>ends with</span><span class='synOp'>|</span><span class='searchOp'>endswith</span><span class='synOp'>&rcub;</span></code>
    <ul><!-- Search Operators Sub-Descriptions -->
      <li><code><span class='searchOp'>=</span><span class='synOp'>|</span><span class='searchOp'>is</span></code> <i><span class='terminator'>- are equivalent and can be used with strings, numbers, booleans, and dates.</span></i></li>
      <li><code><span class='searchOp'>:</span><span class='synOp'>|</span><span class='searchOp'>contains</span><span class='synOp'>|</span><span class='searchOp'>includes</span></code> <i><span class='terminator'>- are primarily for strings but can be used with numbers, booleans, and dates when a record may have multiple of a keyword's value. For example: when searching Featured Search Results <code><span class='keyword'>priority</span> <span class='searchOp'>contains</span> <span class='whatfor'>50</span></code> is also equivalent to <code><span class='keyword'>priority <span class='searchOp'>=</span> <span class='whatfor'>50</span></code> since all sub-values of a Result's matching entries are checked for <code><span class='keyword'>priority <span class='searchOp'>=</span> <span class='whatfor'>50</span></code> when checking for inclusion in the sub-values to find a match.</span></i></li>
      <li><code><span class='searchOp'>&lt;</span><span class='synOp'>|</span><span class='searchOp'>&lt;=</span><span class='synOp'>|</span><span class='searchOp'>starts with</span><span class='synOp'>|</span><span class='searchOp'>startswith</span><span class='synOp'>|</span><span class='searchOp'>begins with</span><span class='synOp'>|</span><span class='searchOp'>beginswith</span></code> <i><span class='terminator'>- are fairly equivalent and interchangeable with the notable exception of <code><span class='searchOp'>&lt;</span></code> with numbers and dates.</span></i></li>
      <li><code><span class='searchOp'>&gt;</span><span class='synOp'>|</span><span class='searchOp'>&gt;=</span><span class='synOp'>|</span><span class='searchOp'>ends with</span><span class='synOp'>|</span><span class='searchOp'>endswith</span></code> <i><span class='terminator'>- are likewise fairly equivalent with the same caveat for <code><span class='searchOp'>&gt;</span></code>.</span></i></li>
    </ul>
    <blockquote>
      <p>Note that even though types (string, number, boolean, date) are for the most part interchangeable with how operators work on them using the arithmetic operators might feel a bit unintuitive with strings and vice versa for string centric operators on numbers. In addition mixing types against keywords that they don't correspond to - such as dates with priorities - may be a waste of effort. Finally all string/text searches are <u>case insensitive</u>.</p>
      <p>Dates are stored on the backend as ISO date+time values (integer offset from relative beginning of time). Advanced Search makes effort to simplify searching by ranging the search to treat them as just a date - so <code><span class='whatfor'>2024-01-01</span></code> means all date+times from <code><span class='whatfor'>2024-01-01 00:00:00</span></code> to just before <code><span class='whatfor'>2024-01-02 00:00:00</span></code>. So, if you search for <code><span class='keyword'>brokensince</span> <span class='searchOp'>&gt;=</span> <span class='whatfor'>2023-12-01</span> <span class='intNeg'>and</span> <span class='keyword'>brokensince</span> <span class='searchOp'>&lt;=</span> <span class='whatfor'>2024-01-02</span></code> you'll get all broken links that were initially detected as broken any time during December of 2023 and until any time during Jan, 2 of 2024. If you had made those <code><span class='searchOp'>&gt;</span></code> and <code><span class='searchOp'>&lt;</span></code> operators instead of <code><span class='searchOp'>&gt;=</span></code> and <code><span class='searchOp'>&lt;=</span></code> then you would end up excluding the whole of the 1st of December and the 2nd of January from that range. You can search for ISO formatted date+time strings but that may be arithmetically incongruent with the comparison arithmetic Advanced Search is performing for dates with the simplifying opinion that they're intended to be searched for as dates and not date+time values.</p>
    </blockquote>
  </li>
  <li><!-- Text or Values to Search For -->
    <code><span class='whatfor'>&lt;text or values to search for&gt;</span> = <span class='synOp'>&lcub;&lcub;</span><span class='terminator'>'</span><span class='synOp'>|</span><span class='terminator'>"</span><span class='synOp'>&rcub;</span><span class='partFor'>&lt;part of value&gt;</span><span class='terminator'>...</span><span class='synOp'>&lcub;</span><span class='terminator'>'</span><span class='synOp'>|</span><span class='terminator'>"</span><span class='synOp'>&rcub;|</span><span class='partFor'>&lt;value&gt;</span><span class='synOp'>&rcub;</span></code>
    <blockquote>
      <p>This is any space delimited value to search for. If you need to include spaces you can enclose the parts of the value in pairs of <code><span class='terminator'>'</span></code> or <code><span class='terminator'>"</span></code> to join them into a whole value to search for otherwise the first space found will treat the "what to search for" portion of the search phrase as delimited and the following text of the search will be used to build search phrases for a compound search.</p>
    </blockquote>
  </li>
</ul>
<br/>
<!-- Result Aliases and Defaults -->
<h2 id="result-keywords-and-defaults">Featured Search Results Keywords and Defaults</h2>
<h3 id="featured-search-results-keywords">Featured Search Results Keywords</h3>
{#if resultMismatches}<!-- Result Mismatch Check -->
  <p class='warning'>WARNING: This listing is out of sync with the actual alias mappings of Featured Search Results. Please <a href='https://git.txstate.edu/gato/dosgato-txstate/issues/new?assignees=rjc94&labels=featured-search&projects=gato/4' target='_blank'>report</a> this discrepancy.</p>
  {#if resultMismatches.notInMapping.length}
    <p class='warning'>Extra mapping{resultMismatches.notInMapping.length > 1 ? 's' : ''} defined here but not in actual mappings:
      {#each resultMismatches.notInMapping as mapping, i}<code class='keyword'>'{mapping}'</code>{i < (resultMismatches.notInMapping.length - 1) ? ', ' : '.'}{/each}
  {/if}
  {#if resultMismatches.notInDisplay.length}
    <p class='warning'>Missing mapping{resultMismatches.notInDisplay.length > 1 ? 's' : ''} defined by the search translator but not listed here:
      {#each resultMismatches.notInDisplay as display, i}<code class='keyword'>'{display}'</code>{i < (resultMismatches.notInDisplay.length - 1) ? ', ' : '.'}{/each}
    </p>
  {/if}
{/if}
<code><!-- Result ALiases Display Table -->
  <table>
    <thead><tr><th>Keyword</th><th>Maps To</th></tr></thead>
    <tbody>
    {#each Object.entries(resultAliases) as alias}
      <tr>
        <td><span class='keyword'>'{alias[0]}'</span></td>
        <td><span class='terminator'>{alias[1]}</span></td>
      </tr>
    {/each}
    </tbody>
  </table>
</code>
<h3 id="defaults-for-results-are">Defaults for Results are:</h3><!-- Result Defaults -->
<code>{#each resultsDef.defaults as field, i}<span class='keyword'>'{field}'</span>{i < resultsDef.defaults.length - 1 ? ', ' : ''}{/each}</code>
<blockquote>Searching for just itac in a search phrase will check each of the above default fields in Featured Result records to see if they contain the text itac.</blockquote>
<br/>
<!-- Query Aliases and Defaults -->
<h2 id="query-keywords-and-defaults">Visitor Searches Keywords and Defaults</h2>
<h3 id="advanced-search-field-aliases-1">Visitor Searches Field Aliases</h3>
{#if queryMismatches} <!-- Query Mismatch Check -->
  <p class='warning'>WARNING: This listing is out of sync with the actual alias mappings of Visitor Search Queries. Please <a href='https://git.txstate.edu/gato/dosgato-txstate/issues/new?assignees=rjc94&labels=featured-search&projects=gato/4' target='_blank'>report</a> this discrepancy.</p>
  {#if queryMismatches.notInMapping.length}
    <p class='warning'>Extra mapping{queryMismatches.notInMapping.length > 1 ? 's' : ''} defined here but not in actual mappings:
      {#each queryMismatches.notInMapping as mapping, i}<code class='keyword'>'{mapping}'</code>{i < (queryMismatches.notInMapping.length - 1) ? ', ' : '.'}{/each}
  {/if}
  {#if queryMismatches.notInDisplay.length}
    <p class='warning'>Missing mapping{queryMismatches.notInDisplay.length > 1 ? 's' : ''} defined by the search translator but not listed here:
      {#each queryMismatches.notInDisplay as display, i}<code class='keyword'>'{display}'</code>{i < (queryMismatches.notInDisplay.length - 1) ? ', ' : '.'}{/each}
    </p>
  {/if}
{/if}
<code><!-- Query Aliases Display Table -->
  <table>
    <thead><tr><th>Keyword</th><th>Maps To</th></tr></thead>
    <tbody>
    {#each Object.entries(queryAliases) as alias}
      <tr>
        <td><span class='keyword'>'{alias[0]}'</span></td>
        <td><span class='terminator'>{alias[1]}</span></td>
      </tr>
    {/each}
    </tbody>
  </table>
</code>
<h3 id="defaults-for-queries-are">Defaults for Visitor Searches are:</h3><!-- Query Defaults -->
<code>{#each queriesDef.defaults as field, i}<span class='keyword'>'{field}'</span>{i < queriesDef.defaults.length - 1 ? ', ' : ''}{/each}</code>
<p><br/></p>

<style>
  strong { font-weight:bold; }
  blockquote { color:dimgrey; font-style:italic; padding-left: 1rem; margin-left: 0rem; }
  code { font-style:normal; }
  table { border-collapse: collapse; }
  td:first-child,th:first-child { padding-right: 1rem; text-align:right;}
  th { text-align:left; padding-bottom: .5rem;}
  .synOp { color:red; }
  .descriptor { color:royalblue; }
  .searchOp { color:darkorange; font-weight:bold; }
  .intNeg { color:mediumpurple; font-weight:bold; }
  .keyword { color:blue; font-weight:bold; }
  .whatfor { color:green; font-style:italic; }
  .partFor { color:forestgreen; font-style:italic; }
  .terminator { color:dimgrey; font-weight:bold; }
  .warning { color:red; font-style:italic; }
</style>
