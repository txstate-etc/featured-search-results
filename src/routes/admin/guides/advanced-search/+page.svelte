<script lang=ts>
  import SvelteMarkdown from 'svelte-markdown'
</script>

<h1 id="admin---advanced-searching-syntax">Admin - Advanced Searching Syntax</h1>
<h2 id="admin---overview">Overview</h2>
<p>The search dialogs in the Admin app allow for either simple searches or advanced searches. Normally if you type a simple bit of text into the search bar and search on it then the default fields associated with that search will be searched against using every spaces separated word you typed in the search bar - with the caveat that you can enclose groups of words with quotes to group them together.</p>
<p>Advanced search triggers on your search <strong>WHEN</strong> you specify one of the keyword aliases in combination with one of the search type operators , OR include one of the intersection or negation operators before a simple search or keyword + operator search. <span class='warning'>WARNING: If you try to form an advanced search but don't spell one of the keywords or operators correctly then the search will run as a simple search against every individual word of your attempted advanced search (quotes caveat in play) - which will most likely lead to results being found that don't jive with what you expected.</span></p>
<p>Where:</p>
<ul>
  <li><code><strong>bold text</strong></code> - are keywords or search options. </li>
  <li><code><i>italic text</i></code> - are variable items. </li>
  <li><code><span class='synOp'>[</span><i>optional</i><span class='synOp'>]</span></code> - syntax components displayed in square brackets are optional. </li>
  <li><code><span class='synOp'>&lcub;</span>x<span class='synOp'>|</span>y<span class='synOp'>|</span>z<span class='synOp'>&rcub;</span></code> - choices of required syntax components separated by <span class='synOp'>|</span> are in curly brackets. </li>
  <li><code><span class='descriptor'>&lt;descriptor&gt;</span></code> - non syntax reference enclosures for framing syntax structure are in angle brackets. </li>
  <li><code><span class='terminator'>...</span></code> - means the previous syntax structure or framed reference is repeatable. </li>
</ul>
<p>Generally the syntax structure goes something like this:</p>
<ul>
  <li>
    <code><span class='descriptor'>&lt;search phrase&gt;</span> = <span class='synOp'>[</span><span class='intNeg'>&lt;intersection or negation&gt;</span><span class='synOp'>]</span> <span class='synOp'>[</span><span class='keyword'>&lt;keyword&gt;</span> <span class='searchOp'>&lt;search type operator&gt;</span><span class='synOp'>]</span> <span class='whatfor'>&lt;text or values to search for&gt;</span></code>
      <blockquote>
        <p>There's optional spacing between a keyword and search type operator as well as the operator and what to search for. Most search operators are math like symbols but some are English participles and so spacing is needed to differentiate the operator from the keyword and search term.</p>
      </blockquote>
      <blockquote>
        <p>Note that what to search for is the only non-optional part of a search phrase - and thus the search is considered a simple search - but if you include a keyword you also need to provide an operator to determine how it's used for the search to be treated as an advanced search. If you exclude the keyword portion of a search phrase the search comparison will search for what you want to search for against multiple default keywords using the default search operators only modified by any inclusion of intersection or negation flags.</p>
      </blockquote>
  <li><code><span class='descriptor'>&lt;compound search&gt;</span> = <span class='synOp'>&lcub;</span><span class='descriptor'>&lt;search phrase&gt;</span><span class='synOp'>&lcub;</span><span class='terminator'>,</span><span class='synOp'>|</span><span class='terminator'>;</span><span class='synOp'>|</span><span class='descriptor'><span class='terminator'>&lt;spaces&gt;</span></span><span class='synOp'>&rcub;&rcub;</span><span class='terminator'>...</span></code></li>
  <li><code><span class='intNeg'>&lt;intersection or negation&gt;</span> = <span class='synOp'>&lcub;&lcub;</span><span class='intNeg'>+</span><span class='synOp'>|</span><span class='intNeg'>and</span><span class='synOp'>&rcub;|&lcub;</span><span class='intNeg'>-</span><span class='synOp'>|</span><span class='intNeg'>not</span><span class='synOp'>&rcub;&rcub;</span></code>
      <blockquote>
        <p>The default behavior for search is to match any of the search phrases - a logical or. Using + or and means the following search phrase expression must be a part of the match in addition to any other matching conditions found - where the result set intersects with the other search phrases result sets rather than the default unioning of result sets together.</p>
      </blockquote>
      <blockquote>
        <p>While obvious in what it means for the search phrase negation currently cannot be combined with intersection. This is done to maintain compatibility with the People Search Advanced Search syntax. I'm open to updating both.</p>
      </blockquote>
  </li>
  <li><code><span class='searchOp'>&lt;search type operator&gt;</span> = <span class='synOp'>&lcub;</span><span class='searchOp'>:</span><span class='synOp'>|</span><span class='searchOp'>=</span><span class='synOp'>|</span><span class='searchOp'>is</span><span class='synOp'>|</span><span class='searchOp'>contains</span><span class='synOp'>|</span><span class='searchOp'>includes</span><span class='synOp'>|</span><span class='searchOp'>&lt;</span><span class='synOp'>|</span><span class='searchOp'>&lt;=</span><span class='synOp'>|</span><span class='searchOp'>beginswith</span><span class='synOp'>|</span><span class='searchOp'>begins with</span><span class='synOp'>|</span><span class='searchOp'>starts with</span><span class='synOp'>|</span><span class='searchOp'>startswith</span><span class='synOp'>|</span><span class='searchOp'>&gt;</span><span class='synOp'>|</span><span class='searchOp'>&gt;=</span><span class='synOp'>|</span><span class='searchOp'>ends with</span><span class='synOp'>|</span><span class='searchOp'>endswith</span><span class='synOp'>&rcub;</span></code>
    <ul>
      <li><code><span class='searchOp'>=</span><span class='synOp'>|</span><span class='searchOp'>is</span></code> - are equivalent and can be used with strings, numbers, booleans, and dates. </li>
      <li><code><span class='searchOp'>:</span><span class='synOp'>|</span><span class='searchOp'>contains</span><span class='synOp'>|</span><span class='searchOp'>includes</span></code> - are primarily for strings but can be used with numbers, booleans, and dates when a record may have multiple of a keyword's value. For example: when searching Featured Search Results <code><span class='keyword'>priority</span> <span class='searchOp'>contains</span> <span class='whatfor'>50</span></code> is also equivalent to <code><span class='keyword'>priority <span class='searchOp'>=</span> <span class='whatfor'>50</span></code> since all sub-values of a Result's matching entries are checked for <code><span class='keyword'>priority <span class='searchOp'>=</span> <span class='whatfor'>50</span></code> when checking for equality to find a match. </li>
      <li><code><span class='searchOp'>&lt;</span><span class='synOp'>|</span><span class='searchOp'>&lt;=</span><span class='synOp'>|</span><span class='searchOp'>starts with</span><span class='synOp'>|</span><span class='searchOp'>startswith</span><span class='synOp'>|</span><span class='searchOp'>begins with</span><span class='synOp'>|</span><span class='searchOp'>beginswith</span></code> - are fairly equivalent and interchangeable with the notable exception of <code><span class='searchOp'>&lt;</span></code> with numbers and dates. </li>
      <li><code><span class='searchOp'>&gt;</span><span class='synOp'>|</span><span class='searchOp'>&gt;=</span><span class='synOp'>|</span><span class='searchOp'>ends with</span><span class='synOp'>|</span><span class='searchOp'>endswith</span></code> - are likewise fairly equivalent with the same caveat for <code><span class='searchOp'>&gt;</span></code>.</li>
        <blockquote>
          <p>Note that even though types (string, number, boolean, date) are for the most part interchangeable with how operators work on them using the arithmetic operators might feel a bit unintuitive with strings and vice versa for string centric operators on numbers. In addition mixing types against keywords that they don't correspond to - such as dates with priorities - may be a waste of effort. Finally all string/text searches are case insensitive.</p>
        </blockquote>
        <blockquote>
          <p>Dates are stored on the backend as ISO date+time values. Advanced Search makes effort to simplify searching by ranging the search to treat them as just a date - so 2024-01-01 means all date+times from 2024-01-01 00:00:00 to just before 2024-01-02 00:00:00. So, if you search for brokensince &gt;= 2023-12-01 and brokensince &lt;= 2024-01-02 you'll get all broken links that were initially detected as broken any time during December of 2023 and until any time during Jan, 2 of 2024. If you had made thos &gt; and &lt; operators instead of &gt;= and &lt;= then you would end up excluding the whole of the 1st of December and the 2nd of January from that range. You can search for ISO formatted date+time strings but that may be arithmetically incongruent with the comparison arithmetic Advanced Search is performing for dates with the simplifying opinion that they're intended to be searched for as dates and not date+time values.</p>
        </blockquote>
    </ul>
  </li>
  <li><code><span class='whatfor'>&lt;text or values to search for&gt;</span> = <span class='synOp'>&lcub;&lcub;</span><span class='terminator'>'</span><span class='synOp'>|</span><span class='terminator'>"</span><span class='synOp'>&rcub;</span><span class='terminator'>&lt;part of value&gt;...<span class='synOp'>&lcub;</span><span class='terminator'>'</span><span class='synOp'>|</span><span class='terminator'>"</span><span class='synOp'>&rcub;|</span><span class='terminator'>&lt;value&gt;</span><span class='synOp'>&rcub;</span></code> This is any space delimited value to search for. If you need to include spaces you can enclose the parts of the value in ' or " to join them into a whole value to search for otherwise the first space found will treat the search phrase as delimited and the following text of the search will be used for the following search phrases in a compound search. </li>
</ul>
<h2 id="result-keywords-and-defaults">Featured Search Results Keywords and Defaults</h2>
<p>Available advanced keywords (left side of :), and what they map to (right side of :) in the Result data are below:</p>
<h3 id="featured-search-results-keywords">Featured Search Results Keywords</h3>
<pre class="ts"><code>  <span class='keyword'>'title'</span>           : <span class='terminator'>'title'</span>
  <span class='keyword'>'pagename'</span>        : <span class='terminator'>'title'</span>
  <span class='keyword'>'page name'</span>       : <span class='terminator'>'title'</span>
  <span class='keyword'>'tag'</span>             : <span class='terminator'>'tags'</span>
  <span class='keyword'>'tags'</span>            : <span class='terminator'>'tags'</span>
  <span class='keyword'>'tagcount'</span>        : <span class='terminator'>'tags.length'</span>
  <span class='keyword'>'tag count'</span>       : <span class='terminator'>'tags.length'</span>
  <span class='keyword'>'url'</span>             : <span class='terminator'>'url'</span>
  <span class='keyword'>'path'</span>            : <span class='terminator'>'url'</span>
  <span class='keyword'>'domain'</span>          : <span class='terminator'>'url'</span>
  <span class='keyword'>'subdomain'</span>       : <span class='terminator'>'url'</span>
  <span class='keyword'>'hostname'</span>        : <span class='terminator'>'url'</span>
  <span class='keyword'>'broken'</span>          : <span class='terminator'>'currency.broken'</span>
  <span class='keyword'>'brokensince'</span>     : <span class='terminator'>'currency.brokensince'</span>
  <span class='keyword'>'duplicateurl'</span>    : <span class='terminator'>'currency.conflictingUrls.url'</span>
  <span class='keyword'>'duplicateurls'</span>   : <span class='terminator'>'currency.conflictingUrls.length'</span>
  <span class='keyword'>'duplicatetitle'</span>  : <span class='terminator'>'currency.conflictingTitles.title'</span>
  <span class='keyword'>'duplicatetitles'</span> : <span class='terminator'>'currency.conflictingTitles.length'</span>
  <span class='keyword'>'duplicatematch'</span>  : <span class='terminator'>'currency.conflictingMatchings.mode'</span>
  <span class='keyword'>'duplicatematches'</span>: <span class='terminator'>'currency.conflictingMatchings.length'</span>
  <span class='keyword'>'matchwords'</span>      : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'match words'</span>     : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'matchwordcount'</span>  : <span class='terminator'>'entries.keywords.length'</span>
  <span class='keyword'>'matchword count'</span> : <span class='terminator'>'entries.keywords.length'</span>
  <span class='keyword'>'keyphrase'</span>       : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'aliases'</span>         : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'keyword'</span>         : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'keywords'</span>        : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'keywordcount'</span>    : <span class='terminator'>'entries.keywords.length'</span>
  <span class='keyword'>'keyword count'</span>   : <span class='terminator'>'entries.keywords.length'</span>
  <span class='keyword'>'search'</span>          : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'query'</span>           : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'term'</span>            : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'terms'</span>           : <span class='terminator'>'entries.keywords'</span>
  <span class='keyword'>'termcount'</span>       : <span class='terminator'>'entries.keywords.length'</span>
  <span class='keyword'>'term count'</span>      : <span class='terminator'>'entries.keywords.length'</span>
  <span class='keyword'>'mode'</span>            : <span class='terminator'>'entries.mode'</span>
  <span class='keyword'>'type'</span>            : <span class='terminator'>'entries.mode'</span>
  <span class='keyword'>'priority'</span>        : <span class='terminator'>'entries.priority'</span>
  <span class='keyword'>'weight'</span>          : <span class='terminator'>'entries.priority'</span>
  <span class='keyword'>'hits'</span>            : <span class='terminator'>'entries.hitCountCached'</span>
  <span class='keyword'>'count'</span>           : <span class='terminator'>'entries.hitCountCached'</span>
</code></pre>
<h3 id="defaults-for-results-are">Defaults for Results are:</h3>
<pre class="js"><code>'title', 'tags', 'url', 'entries.keywords'</code></pre>
<blockquote>Searching for just itac in a search phrase will check each of the above default fields in Featured Result records to see if they contain the text itac.</blockquote>
<h2 id="query-keywords-and-defaults">Visitor Searches Keywords and Defaults</h2>
<p>Available advanced keywords (left side of :), and what they map to (right side of :) in the Visitor Search data are below:</p>
<h3 id="advanced-search-field-aliases-1">Advanced Search Field Aliases</h3>
<pre class="js"><code>  <span class='keyword'>'match words'</span>    : <span class='terminator'>'query'</span>
  <span class='keyword'>'keyphrase'</span>      : <span class='terminator'>'query'</span>
  <span class='keyword'>'aliases'</span>        : <span class='terminator'>'query'</span>
  <span class='keyword'>'keywords'</span>       : <span class='terminator'>'query'</span>
  <span class='keyword'>'query'</span>          : <span class='terminator'>'query'</span>
  <span class='keyword'>'search'</span>         : <span class='terminator'>'query'</span>
  <span class='keyword'>'term'</span>           : <span class='terminator'>'query'</span>
  <span class='keyword'>'terms'</span>          : <span class='terminator'>'query'</span>
  <span class='keyword'>'title'</span>          : <span class='terminator'>'results.title'</span>
  <span class='keyword'>'page name'</span>      : <span class='terminator'>'results.title'</span>
  <span class='keyword'>'url'</span>            : <span class='terminator'>'results.url'</span>
  <span class='keyword'>'path'</span>           : <span class='terminator'>'results.url'</span>
  <span class='keyword'>'domain'</span>         : <span class='terminator'>'results.url'</span>
  <span class='keyword'>'subdomain'</span>      : <span class='terminator'>'results.url'</span>
  <span class='keyword'>'hostname'</span>       : <span class='terminator'>'results.url'</span>
  <span class='keyword'>'hits'</span>           : <span class='terminator'>'hitcount'</span>
  <span class='keyword'>'count'</span>          : <span class='terminator'>'hitcount'</span>
  <span class='keyword'>'hitcount'</span>       : <span class='terminator'>'hitcount'</span>
  <span class='keyword'>'lasthit'</span>        : <span class='terminator'>'lasthit'</span>
  <span class='keyword'>'last hit'</span>       : <span class='terminator'>'lasthit'</span>
  <span class='keyword'>'resultcount'</span>    : <span class='terminator'>'results.length'</span>
  <span class='keyword'>'result count'</span>   : <span class='terminator'>'results.length'</span>
</code></pre>
<h3 id="defaults-for-queries-are">Defaults for Visitor Searches are:</h3>
<pre class="js"><code><span class='keyword'>'query'</span></code></pre>

<style>
  strong { font-weight:bold; }
  blockquote { color:dimgrey; font-style:italic; padding-left: 0rem; margin-left: 0rem; }
  .synOp { color:red; }
  .descriptor { color:royalblue; }
  .searchOp { color:darkorange; }
  .intNeg { color:mediumpurple; }
  .keyword { color:blue; }
  .whatfor { color:green; }
  .terminator { color:dimgrey;}
  .warning { color:red; font-style:italic; }

</style>
