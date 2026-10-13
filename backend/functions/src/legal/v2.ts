/**
 * Terms v2 and Privacy v2 — DRAFTS.
 *
 * NOT PUBLISHED. These are saved into `legalDrafts` so Zack can read
 * them in the admin dashboard and edit them there. Publishing is a
 * separate, deliberate admin action, and joinloane.com is untouched.
 *
 * What changed since v1, and why each one had to:
 *
 *   fee model      v1 says renters pay 15% with a $1.50 minimum and
 *                  lenders receive the full price. Since 2026-10-11 it
 *                  is the reverse: the lender pays 20% and the renter
 *                  pays the listed price. v1 is currently wrong on the
 *                  single most important commercial term.
 *   24 hours       v1 says 48 in two places.
 *   cleaning fee   passes to the lender whole; v1 does not mention it.
 *   same-day       premium, and a 2-hour answer window. New.
 *   Own It         buying outright. v1 describes a sale as paying "the
 *                  listed price plus the service fee", which is now
 *                  wrong twice over.
 *   age            "at least 18" becomes "a current student". Zack's
 *                  call: being a student is the actual requirement,
 *                  and sign-up asks for no birthday.
 *   phone, contacts  new, and not covered by v1 at all.
 *
 * TRY-ON IS NOT IN HERE. It is off for v1 — see v2-tryon.ts, which
 * holds the clauses ready to paste back when the feature returns.
 *
 * Markdown, because that is what LegalDocumentModal renders.
 */

export const TERMS_V2 = String.raw`# Terms of Service

**Effective date:** DRAFT — not yet in effect · **Company:** Loane, Inc., a Delaware corporation · **Contact:** team@joinloane.com

> **This is version 2.** What changed since v1: the service fee moved from the renter to the lender, lenders answer within 24 hours instead of 48, you can now buy a piece outright ("Own It"), and same-day rentals exist. Each is explained below.

## 1. Welcome to Loane

Loane is a marketplace where college students rent, buy, and sell clothing with other students on their campus, and share outfit posts. By creating an account or using the Loane app or website (the "Service"), you agree to these Terms. If you don't agree, don't use Loane.

## 2. Who can use Loane

- **You must be a current student** at a campus Loane supports, using your school email address.
- You can only have one account, and it must be in your real name.
- You can't use Loane if we've previously suspended or removed you.

## 3. Your account

- Keep your login details private. You're responsible for everything that happens under your account.
- Keep your information accurate, including your school email.
- We may ask you to confirm you're a student (for example, with a code sent to your school email), and may limit what you can do until you do.
- **Your phone number is optional.** We ask for it so the other student can reach you about a handoff, and so you can find friends already on Loane. You can remove it in Settings at any time.
- You can delete your account at any time in Settings. Open rentals must be finished or cancelled first.

## 4. How Loane works

**Loane is a platform, not a party to your rental or sale.** Lenders and sellers own their items. Renters and buyers deal with them directly. Loane provides the app, payments, and tools to help, but we don't own, inspect, store, or deliver any item, and we don't guarantee any item's quality, fit, condition, or authenticity.

**Listings.** When you list an item, you confirm that you own it and have the right to rent or sell it; that your photos and description are accurate, including size, condition, and any flaws; that the documented value you enter is an honest estimate of what it would cost to replace; and that it's clean and ready to wear when handed over.

**Rentals.** A renter requests dates. The lender accepts or declines. **The request expires if the lender doesn't answer within 24 hours**, or before the start date, whichever comes first. Once accepted, you arrange the handoff in the app. The lender records a condition photo at drop-off, the renter confirms she received it, and both confirm the return.

**Same-day rentals.** A lender can mark a piece as available the same day it's asked for, and set a premium for it. If you request a piece for today, **the lender has 2 hours to answer** before the request declines itself. The premium is shown before you send the request.

**Own It — buying a piece.** If an item is listed for sale, you can ask to buy it outright. The seller has 24 hours to accept, you arrange the handoff in the app, and **ownership passes when you both confirm**. The piece then leaves the marketplace. You cannot buy a piece that's already promised to someone else for a future rental — you'll see the date it's free.

**Handoffs** happen in person between students. Loane doesn't arrange shipping or delivery. See Section 10 for safety.

## 5. Payments and fees

**The renter pays the listed price.** There is no service fee added for renters or buyers. The price you see is the price you pay.

**Loane's fee is paid by the lender: 20% of the rental or sale price.** It's deducted from what the lender receives, and it's shown in her payout breakdown. There is no minimum fee.

**Cleaning fees pass to the lender in full.** If a lender charges a cleaning fee, Loane takes nothing from it — it reimburses a cost she actually pays. The renter agrees to it before requesting.

**The same-day premium is split like the rental**, 80% to the lender and 20% to Loane, because it's additional earnings rather than a cost being reimbursed.

**Payments are processed by Stripe.** By paying or receiving money on Loane, you also agree to [Stripe's terms](https://stripe.com/legal), including the Stripe Connected Account Agreement for lenders. Loane never stores your full card number.

**Beta period.** While Loane is in beta, payments are arranged directly between students and Loane isn't processing them. The app says so on every rental and purchase. Loane isn't responsible for payments made outside the app.

## 6. Cancellations and refunds

| Who cancels, and when | What happens |
| --- | --- |
| Renter, before the lender accepts | Nothing is charged. |
| Renter, 48+ hours before the start date | Full refund. |
| Renter, within 48 hours of the start date | Lender keeps 50% of the rental price. |
| Lender, at any time | Renter gets a full refund. The cancellation is recorded on the lender's account. |
| Lender never answers | Request expires after 24 hours (2 hours for same-day). Nothing is charged. |
| Buyer or seller, before handoff | The purchase is cancelled and nothing is charged. |

Repeated cancellations may limit your account.

## 7. Taking care of what you borrow

**Renters agree to** return the item on time and in the same condition unless the listing allows otherwise; follow the lender's care notes; and not lend, resell, or alter the item.

**Return window.** After the renter returns an item, the lender has 48 hours to confirm it came back fine or report a problem. If she does neither, the rental completes automatically.

**If something goes wrong.** A lender can report damage, excessive cleaning needs, a missing item, or non-return within that 48-hour window, with photos. Loane reviews the drop-off photo, the return photos, messages, and both sides' accounts before deciding.

**Your liability as a renter.** Before you request a rental, you agree that if Loane decides you're responsible, your saved card may be charged for reasonable cleaning or repair costs, or — for loss, theft, non-return, or damage that can't be repaired — up to the item's documented value shown on the listing. You'll be told the amount and the reason before you're charged. **Nothing is ever held on your card against an item's value.**

**Loane's decision.** Loane makes a good-faith decision based on the evidence available. Loane is not an insurer and doesn't guarantee that a lender will recover the full value of an item.

## 8. Finding friends

If you choose to check your contacts, **only scrambled (hashed) versions of phone numbers are sent** to Loane. We never receive your contacts' names, emails, or phone numbers, and **we never store your address book.** The comparison happens and is thrown away. See the Privacy Policy for the detail.

## 9. Your content

You own the photos, posts, listings, comments, and reviews you share. You give Loane a worldwide, non-exclusive, royalty-free license to host, display, and share your content to run and promote the Service. We'll ask you before using your content in paid advertising.

Only post photos you have the right to share. If you tag or post other people, make sure they're OK with it.

## 10. Rules for using Loane

**Don't list** counterfeit, stolen, or recalled items; underwear, swimwear bottoms, or items that can't be cleaned hygienically; or anything illegal or unsafe.

**Don't** harass, threaten, or discriminate against anyone; post nudity, sexual content, or someone's photo without their permission; take payments, rentals, or disputes outside the app to avoid fees or protections; leave fake reviews or review your own items; or create fake accounts, scrape the app, or interfere with how it works.

**Reviews** must be honest and about a real rental or sale. You can change a review for 48 hours after writing it.

**Reporting and enforcement.** You can report a user, listing, post, comment, review, or rental in the app. We may remove content, limit features, or suspend or remove accounts that break these Terms. If your account is suspended, contact team@joinloane.com to appeal.

## 11. Safety

Meet in public, well-lit places on or near campus. Check the item before you accept it. Keep messages and payments in the app. Loane doesn't run background checks and isn't responsible for what happens at an in-person handoff. **Loane is a marketplace, not an emergency service.** If you feel unsafe, contact campus police or call 911.

## 12. Disclaimers

The Service is provided "as is" and "as available." To the fullest extent the law allows, Loane makes no warranties about the Service or any item, user, or content on it.

## 13. Limitation of liability

To the fullest extent the law allows, Loane won't be liable for indirect, incidental, or consequential damages, or for anything that happens between users. Loane's total liability to you for any claim is limited to the greater of the fees you paid Loane in the 12 months before the claim, or $100.

## 14. Indemnity

You agree to cover Loane's losses and legal costs if a claim against Loane comes from your content, your items, your conduct, or your breaking these Terms.

## 15. Disputes and governing law

These Terms are governed by the laws of the State of South Carolina, without regard to its conflict-of-law rules. Any dispute will be resolved in the state or federal courts located in Richland County, South Carolina. Either of us may bring a qualifying claim in small claims court instead. To the extent the law allows, claims must be brought individually, not as part of a class or representative action. Before filing any claim, contact team@joinloane.com so we can try to resolve it informally.

## 16. Changes to these Terms

We may update these Terms. If a change is significant, we'll tell you in the app or by email before it takes effect. Using Loane after that means you accept the new Terms.

## 17. Contact

Loane, Inc. · team@joinloane.com
`;

export const PRIVACY_V2 = String.raw`# Privacy Policy

**Effective date:** DRAFT — not yet in effect · **Company:** Loane, Inc., a Delaware corporation · **Contact:** team@joinloane.com

> **This is version 2.** What's new since v1: your phone number and finding friends from contacts.

## What we collect

**When you sign up:** your school email address, your first name, the username you choose, and your password. **We do not ask for your date of birth.** Loane is for current college students, which your school email is what establishes.

**Your profile:** anything you add — a photo, a bio, your sizes. Sizes are private unless you turn on showing them.

**Your phone number, if you give it.** It's optional. We use it so the other student can reach you about a handoff, and — if you ask us to — to match you with friends already on Loane. **It is never shown on your public profile.** You can remove it in Settings at any time.

**What you do on Loane:** listings, posts, comments, reviews, messages, rentals, purchases, and a log of meaningful actions (for example, that a listing was viewed) with a timestamp.

## Finding friends from your contacts

This only happens if you tap it, and only when you tap it.

- **Only scrambled (hashed) phone numbers leave your phone.** Your contacts' names, email addresses and photos are never read or sent.
- **We never store your address book.** The scrambled numbers are compared against students who have saved a phone number, the matches are returned, and the request is discarded. There is no copy.
- We can't reverse the scrambling to recover a number from it without a secret key we hold separately. We're being precise rather than reassuring: a phone number is short, so scrambling alone is not enough, which is why the stored version is scrambled a second time with a key the app never sees.
- **Remove your phone number in Settings** and you immediately stop matching anyone's contacts.

## Who else sees your information

- **Other students on your campus** see your public profile, your listings, your posts, and your reviews. They do not see your school email, your phone number, your sizes unless you've turned that on.
- **The student you're renting from or to** sees your name, your profile, and — once a rental is agreed — your phone number, so you can arrange the handoff.
- **Stripe** processes payments. Loane never stores your full card number.
- **Loane admins** can see reports, claims, listings, posts and account details in order to run the service and resolve disputes. 
- **Nobody buys this data.** We don't sell personal information.

## Your choices

- Remove your phone number, at any time, in Settings.
- Turn off showing your sizes.
- Delete your account in Settings, once open rentals are finished or cancelled.
- Choose which notifications you receive.

## Security

Access is controlled by security rules enforced on our servers rather than in the app.

## Changes

We may update this Policy. If a change is significant, we'll tell you in the app or by email before it takes effect.

## Contact

Loane, Inc. · team@joinloane.com
`;
