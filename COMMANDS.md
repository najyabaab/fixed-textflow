# TextFlow Dynamic Commands Reference

A comprehensive guide to all dynamic commands available in TextFlow snippets.

---

## 📝 Form Commands (User Input)

### `{formtext}` - Single-line Text Input

Creates a single-line text input field for customizing text when the snippet is used.

**Syntax:**
```
{formtext: name=fieldName; default=defaultValue; cols=30; formatter=upper}
```

**Settings:**

| Setting | Type | Description |
|---------|------|-------------|
| `name` | Named | Label for the field and data binding reference |
| `default` | Named | Initial value displayed in the input |
| `cols` | Named | Width of the input field in characters |
| `placeholder` | Named | Hint text shown when empty |
| `required` | Named | Make field mandatory (`yes`/`no`) |
| `formatter` | Named | Function to format the value (upper, lower, title, trim) |

**Example:**
```
Hello {formtext: name=Recipient; default=John},
Welcome to our team!
```

When triggered, shows an input labeled "Recipient" with "John" as the default.

---

### `{formparagraph}` - Multi-line Text Input

Creates a multi-line text input area for longer text entries.

**Syntax:**
```
{formparagraph: name=fieldName; default=defaultValue; rows=5; cols=40}
```

**Settings:**

| Setting | Type | Description |
|---------|------|-------------|
| `name` | Named | Label for the field |
| `default` | Named | Initial text in the textarea |
| `rows` | Named | Height of the textarea (number of rows) |
| `cols` | Named | Width of the textarea (number of columns) |
| `placeholder` | Named | Hint text shown when empty |
| `required` | Named | Make field mandatory (`yes`/`no`) |
| `formatter` | Named | Function to format the value |

**Example:**
```
Notes:
{formparagraph: name=Notes; rows=4; cols=50}
```

---

### `{formmenu}` - Dropdown Menu

Creates a dropdown menu for selecting from predefined options.

**Syntax:**
```
{formmenu: option1, option2, option3; name=menuName; default=option1; multiple=no}
```

**Settings:**

| Setting | Type | Description |
|---------|------|-------------|
| First positional | Positional | Comma-separated list of options |
| `name` | Named | Label for the menu |
| `default` | Named | Pre-selected option |
| `multiple` | Named | Allow multiple selections (yes/no) |
| `formatter` | Named | Function to format selected value(s) |

**Example:**
```
Priority: {formmenu: Low, Medium, High; name=Priority; default=Medium}
```

---

### `{formtoggle}` - Toggle Switch/Checkbox

Creates an on/off toggle that can show or hide content.

**Syntax:**
```
{formtoggle: name=toggleName; default=yes}Content to show when ON{endformtoggle}
```

**Settings:**

| Setting | Type | Description |
|---------|------|-------------|
| `name` | Named | Label for the toggle |
| `default` | Named | Initial state (yes/no or true/false) |
| `formatter` | Named | Function to format output |

**Behavior:**
- Without `{endformtoggle}`: Outputs "yes" or "no"
- With `{endformtoggle}`: Shows/hides the enclosed content

**Example:**
```
{formtoggle: name=Include Signature; default=yes}
Best regards,
John Smith
{endformtoggle}
```

---

### `{formdate}` - Date/Time Picker

Creates a date and/or time picker input.

**Syntax:**
```
{formdate: formatString; name=fieldName; default=YYYY-MM-DD; start=2020-01-01; end=2030-12-31}
```

**Settings:**

| Setting | Type | Description |
|---------|------|-------------|
| First positional | Positional | Date/time format |
| `name` | Named | Label for the field |
| `default` | Named | Initial date value (supports relative: `+1d`, `+1w`, `now`) |
| `start` | Named | Minimum selectable date |
| `end` | Named | Maximum selectable date |

**Format Tokens:**

| Token | Meaning | Example |
|-------|---------|---------|
| `YYYY` | 4-digit year | 2026 |
| `YY` | 2-digit year | 26 |
| `MM` | 2-digit month | 01 |
| `MMM` | Short month name | Jan |
| `MMMM` | Full month name | January |
| `DD` | 2-digit day | 31 |
| `Do` | Day with ordinal | 31st |
| `HH` | 24-hour hour | 23 |
| `hh` | 12-hour hour | 11 |
| `mm` | Minutes | 03 |
| `ss` | Seconds | 16 |
| `A` | AM/PM | PM |
| `dddd` | Full weekday | Friday |
| `ddd` | Short weekday | Fri |

**Example:**
```
Meeting Date: {formdate: MMMM Do, YYYY; name=Meeting Date}
```

---

## 🧮 Calculation & Logic Commands

### `{=}` - Formula Command

Performs calculations, string operations, and evaluates expressions.

**Syntax:**
```
{= expression}
```

**Capabilities:**
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- String concatenation: `&`
- Comparisons: `=`, `<>`, `<`, `>`, `<=`, `>=`
- Logic: `and`, `or`, `not`
- Conditionals: `if(condition, trueValue, falseValue)`

**Built-in Functions:**

| Category | Functions |
|----------|-----------|
| Math | `round()`, `floor()`, `ceiling()`, `sqrt()`, `abs()`, `min()`, `max()` |
| Text | `upper()`, `lower()`, `trim()`, `left()`, `right()`, `mid()`, `len()`, `replace()`, `contains()` |
| Date | `today()`, `now()` |
| List | `count()`, `sum()`, `join()`, `split()` |

**Examples:**
```
{= 5 + 10}                     → 15
{= "Hello" & " " & "World"}    → Hello World
{= upper("hello")}             → HELLO
{= if(10 > 5, "Yes", "No")}    → Yes
```

---

### `{if}` - Conditional Content

Shows or hides content based on a condition.

**Syntax:**
```
{if: condition}Content when true{else}Content when false{endif}
```

**Example:**
```
{if: count > 10}That's a lot of items!{else}Not too many items.{endif}
```

---

### `{repeat}` - Repeat Content

Repeats a block of content a specified number of times or over a list.

**Syntax (count):**
```
{repeat: count}Content to repeat{endrepeat}
```

**Syntax (for loop):**
```
{repeat: for item in list}Content with {=item}{endrepeat}
```

**Special Variables:**
- `{=i}` - 0-based index
- `{=index}` - 1-based index

**Example:**
```
{repeat: 3}• Item
{endrepeat}
```

Produces:
```
• Item
• Item
• Item
```

---

## 🕐 Date & Time Commands

### `{time}` - Current Date/Time

Inserts the current date and/or time with optional formatting and shifting.

**Syntax:**
```
{time: formatString; shift=modifier; at=specificDate; locale=en}
```

**Settings:**

| Setting | Type | Description |
|---------|------|-------------|
| First positional | Positional | Date/time format |
| `shift` | Named | Adjust date/time |
| `at` | Named | Use a specific date instead of now |
| `locale` | Named | Language/region for formatting |

**Shift Modifiers:**

| Modifier | Meaning |
|----------|---------|
| `+5D` | 5 days from now |
| `-2W` | 2 weeks ago |
| `+1M` | 1 month from now |
| `+1Y` | 1 year from now |
| `>MON` | Next Monday |
| `<FRI` | Previous Friday |

**Examples:**
```
{time: MMMM Do, YYYY}              → January 31st, 2026
{time: MM/DD/YYYY; shift=+10D}     → 02/10/2026
{time: HH:mm:ss}                   → 23:03:16
{time: dddd}                       → Friday
```

---

## 🌐 Web & Automation Commands

### `{site}` - Extract Web Page Data

Inserts information from the current webpage.

**Syntax:**
```
{site: selector; page=pagePattern; attribute=attr}
```

**Built-in Selectors:**
- `url` - Page URL
- `title` - Page title
- `domain` - Domain name
- `selection` - Selected text

**Example with CSS Selector:**
```
Page Title: {site: title}
Email Subject: {site: input[name="subject"]; attribute=value}
```

---

### `{click}` - Click an Element

Programmatically clicks a button, link, or other element on the page.

**Syntax:**
```
{click: selector}
```

**Supported Selectors:**
- CSS: `#id`, `.class`, `input[type="submit"]`
- Text Match: `text=Submit`, `text~=Log in` (partial/regex)
- XPath: `xpath://button[@type='submit']`

**Example:**
```
{click: text="Sign In"}  → Clicks button with exact text "Sign In"
{click: text~="Next"}    → Clicks button containing "Next"
{wait: 1000}
Form submitted!
```

---

### `{key}` - Simulate Key Press

Simulates pressing a key or key combination.

**Syntax:**
**Syntax:**
```
{key: keyName; count=N; delay=ms}
```

**Supported Keys:**
- Basic: `tab`, `enter`, `esc`, `backspace`, `space`, `delete`, `insert`
- Navigation: `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`
- Modifiers: `ctrl`, `shift`, `alt`, `cmd`/`win` (e.g., `ctrl+c`)
- Function: `f1` through `f12`

**Example:**
```
{formtext: name=Field 1}
{key: tab; count=2}  → Press Tab twice
{formtext: name=Field 3}
```

---

### `{wait}` - Pause Execution

Pauses for time or until element appears.

**Syntax:**
```
{wait: milliseconds}
{wait: selector}
{wait: text="Loading..."}
```

**Example:**
```
{click: button.load-more}
{wait: 2000}
{site: .results-count}
```

Clicks a button, waits 2 seconds for content to load, then extracts data.

---

## 📋 Content & Reference Commands

### `{clipboard}` - Insert Clipboard Contents

Inserts whatever is currently copied to the clipboard, with optional whitespace trimming and full formula engine integration.

**Syntax:**
```
{clipboard}
{clipboard: trim=yes}
{clipboard: trim=left}
{clipboard: trim=right}
```

**Named Arguments:**

| Argument | Values | Description |
|----------|--------|-------------|
| `trim` | `yes`, `no`, `left`, `right` | Controls whitespace removal around the command |

**Trim Behavior:**
- `yes`: Remove whitespace immediately before AND after the command
- `left`: Only remove whitespace to the left
- `right`: Only remove whitespace to the right
- `no` (default): Preserve surrounding whitespace

**Basic Examples:**
```
You copied: {clipboard}
```

```
Before   {clipboard: trim=yes}   After
→ "BeforecontentAfter"
```

**Formula Integration:**

The clipboard content is available as a `clipboard` variable in formulas for advanced text processing:

```
Length: {= len(clipboard)} characters
Uppercase: {= upper(clipboard)}
```

**Regex Extraction:**

Extract specific data from clipboard using `extractregex()`:

```
Dear {= extractregex(clipboard, "Name: ([^,]+)")}
```

If clipboard contains `"Name: John Doe, Phone: 555-1234"`, outputs: `"Dear John Doe"`

**Error Handling with `catch()`:**

Use `catch()` to provide fallback values when regex patterns don't match:

```
Dear {= catch(extractregex(clipboard, "Name: ([^,]+)"), "Customer")}
```

If the name pattern is not found, outputs: `"Dear Customer"`

**Conditional Logic with `testregex()`:**

```
{if: testregex(clipboard, "@")}
Email detected: {clipboard}
{else}
Not an email
{endif}
```

**Real-World Example - Contact Card:**

```
## Contact Information

Name: {= catch(extractregex(clipboard, "Name:\\s*([^\\n]+)"), "Unknown")}
Email: {= catch(extractregex(clipboard, "([\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,})"), "Not provided")}
Phone: {= catch(extractregex(clipboard, "(\\d{3}-\\d{3}-\\d{4})"), "Not provided")}
```

**Permissions:**
Requires clipboard read permission. If permission is denied, returns empty string gracefully.

---

### `{cursor}` - Position Cursor After Insertion

Designates a specific location within the snippet text where the caret must be placed once insertion is complete.

**Syntax:**
```
{cursor}
{cursor: trim=yes}
{cursor: trim=left}
{cursor: trim=right}
```

**Named Arguments:**

| Argument | Values | Description |
|----------|--------|-------------|
| `trim` | `yes`, `no`, `left`, `right` | Controls whitespace removal around the cursor position |

**Trim Behavior:**
- `yes`: Remove whitespace immediately before AND after the command
- `left`: Only remove whitespace to the left
- `right`: Only remove whitespace to the right
- `no` (default): Preserve surrounding whitespace

**Constraint:**
Only one `{cursor}` command is allowed per snippet. If multiple are detected, a validation error will be thrown.

**Examples:**

Basic usage:
```
Hello {cursor},
This is where your cursor will be.
```

With trim to clean up spacing:
```
function example() {
    {cursor: trim=yes}
}
```
Result: Cursor positioned inside the function with no extra whitespace.

**Integration with Autopilot:**

The cursor command works seamlessly with autopilot commands like `{key: tab}`:

```
{cursor}Hi {formtext: name=name}
Thank you for your message!
{key: shift-tab}
{key: shift-tab}
{key: enter}
```

Flow:
1. Text is inserted
2. Cursor moves to the marked position (before "Hi")
3. Shift-Tab commands navigate backward
4. Enter is pressed


---

### `{link}` - Create Hyperlink

Creates a clickable hyperlink.

**Syntax:**
```
{link: https://example.com}Click here{endlink}
```

**Example:**
```
{link: https://google.com}Search on Google{endlink}
```

---

### `{note}` - Internal Comment/Instruction

Embeds comments, instructions, or warnings within a snippet that are visible during preview but excluded from final inserted text.

**Syntax:**
```
{note: preview=yes; insert=no; color=none; trim=yes}Content{endnote}
```

**Named Arguments:**

| Argument | Values | Default | Description |
|----------|--------|---------|-------------|
| `preview` | `yes`, `no` | `yes` | Show this note in the snippet preview window |
| `insert` | `yes`, `no` | `no` | Force inclusion of note text in final output |
| `color` | `none`, `red`, `green`, `yellow`, `blue` | `none` | Visual styling in preview (icon color) |
| `trim` | `yes`, `no`, `left`, `right` | `no` | Remove surrounding whitespace to prevent ghost newlines |

**Use Cases:**
- **Team Documentation**: Reminders visible during snippet use
- **Hidden Logic Comments**: Developer notes invisible to end users
- **Conditional Output**: Rarely, force notes into output with `insert=yes`
- **Clean Formatting**: Use `trim=yes` when note is on its own line to avoid blank lines

**Examples:**

Standard note (visible in preview, not in output):
```
Hello {note}Check spelling here{endnote} World
```
- Preview: `ℹ️ NOTE: Check spelling here`
- Output: `Hello World`

Hidden note (invisible in preview):
```
{note: preview=no}This is for developers only{endnote}
```
- Preview: (no note shown)
- Output: (empty)

Forced insertion (rare case):
```
{note: insert=yes}This will appear in output{endnote}
```
- Preview: `ℹ️ NOTE: This will appear in output`
- Output: `This will appear in output`

Color-coded warnings:
```
{note: color=red; trim=yes}
IMPORTANT: Fill out all required fields before submitting.
{endnote}
```
- Preview: `🔴 NOTE: IMPORTANT: Fill out all required fields before submitting.`
- Output: (empty, trim removes the newlines)

Trim whitespace to prevent ghost lines:
```
Line 1
{note: trim=yes}
This note is on its own line
{endnote}
Line 2
```
- Output: `Line 1\nLine 2` (no blank lines)

---

## 🔧 Advanced Commands

### `{import}` - Include Another Snippet

Imports and executes another snippet by its shortcut.

**Syntax:**
```
{import: shortcut}
```

**Notes:**
- Form fields with the same name are linked
- Escape special characters: `\;`, `\=`, `\{`, `\}`

**Example:**
```
{import: /signature}
```

---

### `{snippet}` - Snippet Metadata

Inserts information about the current snippet itself.

**Syntax:**
```
{snippet: property}
```

**Properties:**
- `id` - Unique snippet ID
- `shortcut` - The trigger shortcut
- `name` - Snippet name

---

### `{run}` - Execute Code Block

Executes a code block once without inserting its result.

**Syntax:**
```
{run: expression}{endrun}
```

**Use Case:** Setting variables or performing actions without output.

---

### `{user}` - User Properties

Inserts user-specific properties defined in settings.

**Syntax:**
```
{user: propertyName}
```

**Example:**
```
Department: {user: department}
Manager: {user: manager}
```

---

### `{error}` - Form Validation

Prevents snippet insertion until conditions are met.

**Syntax:**
```
{if: condition}{error: Error message}{endif}
```

**Example:**
```
{if: len(formtext_name) = 0}{error: Please enter a name}{endif}
```

Blocks submission until the name field has content.

---

## 📊 Form Appearance Summary

When a snippet with form commands is triggered:

| Command | UI Element |
|---------|------------|
| `{formtext}` | Single-line text input |
| `{formparagraph}` | Multi-line textarea |
| `{formmenu}` | Dropdown select menu |
| `{formtoggle}` | Checkbox/toggle switch |
| `{formdate}` | Date picker calendar |

All form elements appear in a preview panel before the snippet is inserted, allowing users to fill in values and preview the result.

---

## 💡 Tips & Best Practices

1. **Name your fields** - Always use descriptive names for form fields
2. **Set defaults** - Provide sensible defaults to speed up form filling
3. **Use formatters** - Apply formatting at insertion time for consistency
4. **Test incrementally** - Build complex snippets step by step
5. **Use notes** - Document complex snippets for future reference
6. **Escape special characters** - Use `\{`, `\}`, `\;`, `\=` when needed

---

### `{set}` - Variable Assignment
Also supports direct assignment `{x = 10}`.

**Syntax:**
```
{set: variableName = expression}
{x = 10}
```

**Example:**
```
{price = 100}
{tax = price * 0.2}
Total: {= price + tax}
```

---

### `{wait}` - Wait for Element
Pauses until an element exists (useful for slow pages).

**Syntax:**
```
{wait: selector}
```

**Example:**
```
{click: #load-button}
{wait: .results-grid}
Data: {site: .results-grid}
```

---

## 🚀 Advanced Functions

### List Functions
Process arrays of data.

- `map(list, item => expression)` - Transform list
- `filter(list, item => condition)` - Filter list
- `reduce(list, (acc, item) => expression, initial)` - Reduce list
- `sort(list)` - Sort list
- `first(list)`, `last(list)` - Get items
- `count(list)`, `sum(list)`, `join(list, separator)`

**Example:**
```
{numbers = [1, 2, 3, 4]}
Doubled: {= join(map(numbers, n => n * 2), ", ")}
Even only: {= join(filter(numbers, n => n % 2 = 0), ", ")}
```

### Regex Functions
Regular expression matching and extraction with error handling.

- `testregex(text, pattern)` - Returns true/false
- `extractregex(text, pattern)` - Returns first match or capture group
  - **Returns**: Captured group `match[1]` if pattern has capture groups, otherwise full match `match[0]`
  - **Throws**: Error "No match found" if pattern doesn't match
  - **Use with**: `catch()` function for fallback logic
- `replaceregex(text, pattern, replacement)` - Replace matches
- `catch(expression, fallback)` - Error handling function
  - **Returns**: Result of expression if successful, or fallback value if error occurs
  - **Use**: Wrap `extractregex()` calls to provide defaults when patterns don't match

**Examples:**
```
{phone = "Call 555-1234"}
Extracted: {= extractregex(phone, "\\d{3}-\\d{4}")}
→ "555-1234"
```

**With Capture Groups:**
```
{text = "Name: John Doe"}
First Name: {= extractregex(text, "Name: (\\w+)")}
→ "John"
```

**With Error Handling:**
```
{data = "Phone: 555-0199"}
Name: {= catch(extractregex(data, "Name: ([^,]+)"), "Unknown")}
→ "Unknown" (pattern didn't match, fallback used)
```

### Date Parts
Extract value from dates.

- `year(date)`, `month(date)`, `day(date)`, `weekday(date)`
- `today()`, `now()`

**Example:**
```
Current Year: {= year()}
Is Weekend: {= if(contains(weekday(), "S"), "Yes", "No")}
```

### JSON Functions
- `json(object)` - Stringify
- `fromjson(string)` - Parse

---

## 🔄 Logic Updates

### `elseif` Support
Chain multiple conditions.

**Syntax:**
```
{if: x > 10}
  High
{elseif: x > 5}
  Medium
{else}
  Low
{endif}
```

### Date Shifting Updates
Added support for hours and minutes.

- `+1H` - Add 1 hour
- `+30m` - Add 30 minutes

```
Meeting time: {time: HH:mm; shift=+1H}
```

### XPath Support
Use XPath in `{site}` command by prefixing with `xpath:` or `//`.

```
{site: xpath://div[@class='content']/p[1]}
```

---

*TextFlow Dynamic Commands v2.1*
