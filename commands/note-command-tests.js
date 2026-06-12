/**
 * Test Examples for {note} Command
 * 
 * This file contains comprehensive test cases for the note command.
 * Notes are internal comments/instructions visible during preview but excluded from final output.
 */

// ============================================
// TEST 1: Basic Note (Default Behavior)
// ============================================
console.log("Test 1: Basic Note - Default Behavior");
const snippet1 = `Hello {note}Check spelling{endnote} World`;
// Expected:
// - Preview: Shows "ℹ️ NOTE: Check spelling"  
// - Output: "Hello World" (note text excluded)

// ============================================
// TEST 2: Note on Its Own Line (Whitespace Issue)
// ============================================
console.log("Test 2: Note on Own Line Without Trim");
const snippet2 = `Line 1
{note}
This is a note
{endnote}
Line 2`;
// Expected:
// - Preview: Shows "ℹ️ NOTE: This is a note"
// - Output: "Line 1\n\n\nLine 2" (ghost blank lines from note tags)
// NOTE: This is WHY trim is important!

// ============================================
// TEST 3: Note with trim=yes (Recommended)
// ============================================
console.log("Test 3: Note with Trim");
const snippet3 = `Line 1
{note: trim=yes}
This is a note
{endnote}
Line 2`;
// Expected:
// - Preview: Shows "ℹ️ NOTE: This is a note"
// - Output: "Line 1\nLine 2" (no ghost blank lines)

// ============================================
// TEST 4: Hidden Note (preview=no)
// ============================================
console.log("Test 4: Hidden Note");
const snippet4 = `{note: preview=no}Secret developer comment{endnote}
Visible content`;
// Expected:
// - Preview: Shows only "Visible content" (no note)
// - Output: "Visible content"

// ============================================
// TEST 5: Forced Insertion (insert=yes)
// ============================================
console.log("Test 5: Forced Insertion");
const snippet5 = `{note: insert=yes}This text IS inserted{endnote}`;
// Expected:
// - Preview: Shows "ℹ️ NOTE: This text IS inserted"
// - Output: "This text IS inserted"

// ============================================
// TEST 6: Color Variants (Preview Only)
// ============================================
console.log("Test 6: Color Variants");
const snippet6 = `{note: color=red}Red warning{endnote}
{note: color=green}Green info{endnote}
{note: color=yellow}Yellow caution{endnote}
{note: color=blue}Blue note{endnote}
{note: color=none}Default note{endnote}`;
// Expected Preview:
// 🔴 NOTE: Red warning
// 🟢 NOTE: Green info
// 🟡 NOTE: Yellow caution
// 🔵 NOTE: Blue note
// ℹ️ NOTE: Default note
// Output: (empty for all)

// ============================================
// TEST 7: Team Documentation Example
// ============================================
console.log("Test 7: Team Documentation");
const snippet7 = `{note: color=red; trim=yes}
IMPORTANT: Remember to update the Case ID field before sending!
{endnote}
Dear Customer,

Thank you for contacting support.

Case ID: {textfield: name=CaseID}`;
// Expected:
// - Preview: Shows red warning note and form field
// - Output: Email template with filled Case ID (no note)

// ============================================
// TEST 8: Multiple Notes in One Snippet
// ============================================
console.log("Test 8: Multiple Notes");
const snippet8 = `{note: color=blue; trim=yes}Header instructions{endnote}
Hello {textfield: name=Name},

{note: color=yellow; trim=yes}Body guidelines{endnote}
Your request has been processed.

{note: color=green; trim=yes}Footer reminder{endnote}
Best regards`;
// Expected:
// - Preview: Shows all three colored notes
// - Output: Clean text with no notes

// ============================================
// TEST 9: Integration with Form Fields
// ============================================
console.log("Test 9: Integration with Form Fields");
const snippet9 = `{note: trim=yes}
Fill in customer details below:
{endnote}
Name: {textfield: name=CustomerName}
Email: {textfield: name=CustomerEmail}
{note: color=red; trim=yes}
Verify email format before sending!
{endnote}`;
// Expected:
// - Preview: Shows both notes and form fields
// - Output: Only filled form fields (no notes)

// ============================================
// TEST 10: Note with Variable Substitution
// ============================================
console.log("Test 10: Note with Variables");
const snippet10 = `{name = "John"}
{note}Author: {name}{endnote}
Hello, this is content.`;
// Expected:
// - Variables should be processed in note content
// - Preview: "ℹ️ NOTE: Author: John"
// - Output: "Hello, this is content."

// ============================================
// TEST 11: Trim Left Only
// ============================================
console.log("Test 11: Trim Left");
const snippet11 = `Text   {note: trim=left}note{endnote}   more`;
// Expected:
// - Left whitespace trimmed, right preserved
// - Output: "Text   more"

// ============================================
// TEST 12: Trim Right Only
// ============================================
console.log("Test 12: Trim Right");
const snippet12 = `Text   {note: trim=right}note{endnote}   more`;
// Expected:
// - Right whitespace trimmed, left preserved  
// - Output: "Text   more"

// ============================================
// TEST 13: Complex Real-World Example
// ============================================
console.log("Test 13: Real-World Support Template");
const snippet13 = `{note: color=blue; trim=yes}
Support Ticket Response Template v2.1
Last updated: {time: YYYY-MM-DD}
{endnote}

Hello {textfield: name=CustomerName; default=Customer},

{note: color=yellow; trim=yes}
Choose appropriate response based on issue type
{endnote}

{if: {formtoggle: name=IssueResolved; default=yes}}
We're pleased to inform you that your issue has been resolved.
{note: trim=yes}Include resolution details{endnote}

{else}
We're actively working on your issue and will update you shortly.
{note: trim=yes}Provide timeline estimate{endnote}
{endif}

{note: color=red; trim=yes}
CRITICAL: Update ticket status in CRM before sending!
{endnote}

Best regards,
Support Team`;
// Expected:
// - Preview: Shows all colored notes and conditional logic
// - Output: Clean email with resolved variables/conditions (no notes)

// ============================================
// USAGE NOTES
// ============================================
/*
 * The {note} command supports:
 * 
 * PREVIEW PARAMETER:
 * - preview=yes (default): Note visible in form preview
 * - preview=no: Note hidden from preview (pure code comment)
 * 
 * INSERT PARAMETER:
 * - insert=no (default): Note excluded from output
 * - insert=yes: Force note text into final output (rare use case)
 * 
 * COLOR PARAMETER:
 * - none (default): ℹ️ info icon
 * - red: 🔴 warning/error
 * - green: 🟢 success/confirmation
 * - yellow: 🟡 caution/attention
 * - blue: 🔵 information
 * 
 * TRIM PARAMETER:
 * - trim=yes: Remove whitespace before AND after (recommended for notes on own lines)
 * - trim=no (default): Preserve whitespace
 * - trim=left: Remove whitespace only on left
 * - trim=right: Remove whitespace only on right
 * 
 * BEST PRACTICES:
 * - Always use trim=yes for notes on their own lines
 * - Use color coding for different note types (warnings, info, etc.)
 * - Use preview=no for developer-only comments
 * - Rarely use insert=yes (defeats purpose of notes)
 * 
 * COMMON PITFALLS:
 * - Forgetting trim=yes causes ghost blank lines in output
 * - Using notes for content that should be conditional {if} blocks
 */
