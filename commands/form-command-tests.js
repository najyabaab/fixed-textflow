/**
 * Test Examples for Form Commands
 * 
 * Verifies {textfield}, {formparagraph}, and {dropdown} enhancements
 */

// ============================================
// TEST 1: Form Text with Cols and Formatter
// ============================================
console.log("Test 1: Form Text");
const snippet1 = `Hello {textfield: name=name; default=World; cols=20; formatter=upper}`;
// Expected: UI shows input with width ~20ch. 
// Input "john", Output "Hello JOHN"

// ============================================
// TEST 2: Form Paragraph with Rows, Cols, Trim
// ============================================
console.log("Test 2: Form Paragraph");
const snippet2 = `Start {formparagraph: name=bio; rows=5; cols=40; trim=yes} End`;
// Expected: UI shows textarea 5 rows high.
// Input "  content  ", Output "StartcontentEnd"

// ============================================
// TEST 3: Form Menu with Item Formatter
// ============================================
console.log("Test 3: Form Menu Item Formatter");
const snippet3 = `Selection: {dropdown: a; b; c; name=letter; itemformatter=upper}`;
// Expected: UI shows selectable "a", "b", "c".
// Select "a", Output "Selection: A" (because single item treated as list of 1 for itemformatter logic? Or formatter?)
// Handler logic: if itemformatter present, it applies to value. If single value, applies to [value][0].

// ============================================
// TEST 4: Form Menu with Multiple and List Formatter
// ============================================
console.log("Test 4: Form Menu Multiple");
const snippet4 = `Colors: {dropdown: Red; Green; Blue; name=colors; multiple=yes; formatter=join(values, " + ")}`;
// Expected: UI allows multiple selection.
// Select "Red" and "Blue", Output "Colors: Red + Blue"

// ============================================
// TEST 5: Form Menu with Item AND List Formatter
// ============================================
console.log("Test 5: Form Menu Item + List Formatter");
const snippet5 = `Items: {dropdown: apple; banana; name=fruit; multiple=yes; itemformatter=upper; formatter=join(values, ", ")}`;
// Expected: 
// Select "apple", "banana".
// Itemformatter runs -> ["APPLE", "BANANA"]
// Listformatter runs -> "APPLE, BANANA"
// Output: "Items: APPLE, BANANA"

// ============================================
// TEST 6: Form Menu with Index in Item Formatter
// ============================================
console.log("Test 6: Form Menu Index");
const snippet6 = `Rank: {dropdown: Gold; Silver; Bronze; name=rank; itemformatter=index + ". " + item}`;
// Expected:
// Select "Gold".
// Itemformatter -> "1. Gold"
// Output: "Rank: 1. Gold"

// ============================================
// TEST 7: Form Text with Required
// ============================================
console.log("Test 7: Required Field");
const snippet7 = `Required: {textfield: name=req; required=yes}`;
// Expected: Cannot submit empty form.

// ============================================
// TEST 8: Form Menu Cols
// ============================================
console.log("Test 8: Menu Cols");
const snippet8 = `Wide Menu: {dropdown: Short; options; name=wide; cols=50}`;
// Expected: UI shows very wide dropdown.
