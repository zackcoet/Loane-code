# Tagging pieces in a post

*Designed in Phase 2. Built in Phase 3. This document is the design.*

## What it is

A post has several photos. On each photo you can pin a dot to a specific
spot — on the dress, on the boots. Tapping the photo pops small labels
showing the item name and what it costs to rent or buy. Tapping a label
opens that listing.

This is the bridge from *"cute outfit"* to *"I can rent that"*, and it is
the single most important interaction in the product. It is also how we
answer MVP question 2: does the social side actually drive rentals? The
`tagged_item_tap` event measures exactly that.

## The shape

```
Post
├── photos: PostPhoto[]
│   └── PostPhoto = ImageRef + tags: PhotoTag[]
│       └── PhotoTag { x, y, listingId, ownerUid, label }
├── taggedListingIds: string[]     ← flattened, for querying
└── taggedListings: ListingSummary[] ← flattened, for the summary row
```

Types live in [`shared/src/types/post.ts`](../shared/src/types/post.ts).

## Five decisions, and why

### 1. Positions are fractions, never pixels

```ts
{ x: 0.42, y: 0.68 }
```

`0.42` means "42% across the photo". The same photo renders at a different
size on every phone — and larger again on the admin dashboard — so a pixel
coordinate would drift off the garment on any screen but the one it was
placed on. A fraction is correct everywhere, forever, including if we
re-crop the image later.

### 2. Tags belong to the photo, not the post

A post has several photos, and a garment appears in one of them. Hanging
tags off the post would mean storing "which photo?" separately and keeping
the two in step. Putting them on the photo makes that impossible to get
wrong.

### 3. The label is a snapshot, and that is a deliberate trade

Each tag carries a copy of the item name and price. Tapping a photo with
four tags renders instantly, instead of firing four database reads while
the labels pop in one by one.

**The cost:** if the owner changes her price, the label goes stale.

**Why that's acceptable:** the label is a preview. Tapping it opens the
listing, which is always live, and that is where anyone actually decides
to rent. A slightly stale price on a label is a much smaller problem than
a laggy tap.

**If it becomes a real problem:** a Cloud Function watching `listings` can
refresh the labels on posts that tag a changed listing. The
`taggedListingIds` array is exactly the query it would need. We are not
building that until it matters.

### 4. `taggedListingIds` exists purely so we can query

Firestore's `array-contains` only works on plain values, not on objects.
Without a flat array of ids, "which posts feature this dress?" would be
unanswerable — which is what the **Seen in posts** section on a listing's
page needs.

Both flattened fields are derived from the per-photo tags and are written
by a Cloud Function, so they can never disagree with what is actually
pinned to the photos.

### 5. Your own closet only — for now, and by a rule, not by shape

**At launch you may only tag your own pieces.** Two reasons: someone
tagging a friend's listing without asking is a small harassment vector, and
at launch almost every post will feature the poster's own closet anyway.

Enforced in the security rules:

```
tag.ownerUid == post.authorUid
```

**This is why every tag stores `ownerUid` even though it is currently
always the author.** Storing it explicitly rather than inferring it means
opening tagging up later changes one line in the rules and nothing else —
no stored document is touched, no migration runs.

## Opening it up later

When we allow tagging a friend's piece, there are two shapes, and it is a
product decision rather than a technical one:

| | How it works | Trade-off |
|---|---|---|
| **Open** (Instagram-style) | Tag anyone's listing. The owner can remove a tag of hers. | Frictionless, more discovery. Someone could tag a piece to get attention. |
| **Consent** | The tag is pending until the owner approves it. | Safer, but a tag that shows up two days later is a tag nobody sees. |

**My recommendation when we get there:** open, plus a "remove this tag"
control for the owner and a report path. Consent-first kills the loop that
makes tagging worth having.

Either needs: a notification to the owner, a way for her to remove a tag,
and a rule change. The data model already supports both.

## Built in Phase 3

- [x] Tap-to-place tagging while composing a post
- [x] A picker limited to the author's own active listings
- [x] Tap-photo-to-reveal labels in the feed
- [x] Tapping a label opens the listing, logging `tagged_item_tap`
- [x] `createPost` derives `taggedListingIds` / `taggedListings` from the
      per-photo tags and moves `listing.stats.tagCount`; `deletePost`
      hands the counts back
- [x] The **Seen in posts** strip on a listing
- [x] Own-closet-only enforced in `createPost`, plus tests

One change from the design: rather than a rule asserting
`tag.ownerUid == post.authorUid`, the rules forbid the app from creating
a post at all and `createPost` does the check. Rules cannot bump a
counter on another document, and splitting the work would have meant two
places that could disagree.
