# Kitchen Companion food imagery

Status: approved product art direction  
Style version: `kitchen-companion-editorial-v1`

## The standard

Recipe photography should feel like a contemporary premium cookbook: natural, appetising and composed with restraint. Food must retain real texture. Light comes from a soft window, the colour balance stays warm-neutral, and a little photographic grain is welcome.

The reference direction is the cannellini bean hero used on Today: a handmade off-white bowl, deep forest-green surface, subtle linen and generous negative space. It should inspire a family of images, not become a repeated template.

## Controlled variety

Rotate deliberately between:

- dark stone with negative space;
- beautifully dressed tables with natural linen, handmade ceramics and restrained glassware;
- pale stone with soft tonal shadows;
- refined timber with modern place settings;
- overhead, close-overhead and gentle three-quarter camera angles.

Keep the visual family coherent through natural light, restrained styling, real food texture and the Kitchen Companion palette. The dish remains the subject; props support it rather than competing with it.

## Avoid

- glossy stock-photography shine or plastic food;
- oversaturation and heavy HDR;
- excessive garnish, floating ingredients or impossible food geometry;
- perfect symmetry and repetitive identical staging;
- fake labels, logos, text or branded packaging;
- rustic farmhouse clichés;
- generic image placeholders presented as real food photography.

If photography is unavailable, the interface must show the honest illustrated `Image pending` state rather than a misleading synthetic meal.

## Generation and provenance

The shared prompt builder is `src/lib/recipeImageArtDirection.ts`. Generated imagery must store:

- style version;
- provider and model;
- full prompt and generation timestamp;
- recipe/content version;
- an `ai_generated` provenance flag;
- review status and reviewer when approved.

Generated images are optional supporting media. Licensed creator photography and owned editorial photography remain preferable when available. Never imitate a named photographer, creator or publication.

The first 12 approved starter assets and their complete prompts are recorded in
`catalogue/media/starter-images.json`. The remaining beta catalogue has a
recipe-specific, human-reviewable queue at
`catalogue/media/beta-200-image-queue.json`; regenerate it with
`npm run catalogue:media-queue`. A queued prompt does not make an image public:
each asset must be generated separately, checked against its recipe, uploaded,
and attached in a new immutable recipe content version.

## Recipe-card use

- Primary crop: vertical 4:5.
- Preserve a safe centre crop for smaller list rows.
- Never place important food detail beneath save buttons or status labels.
- Use one image as the anchor; keep badges and metadata quiet.
- The recipe name, source/verification, time, pantry match and one clear action are the maximum first-glance information.
