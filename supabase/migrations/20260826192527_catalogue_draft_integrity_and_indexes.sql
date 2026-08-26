-- Draft catalogue records must not claim a verification tier before review.
-- Published snapshots retain their required tier and the review RPC assigns it
-- atomically when an administrator approves a recipe.
alter table public.recipes
  alter column verification_tier drop not null,
  alter column verification_tier drop default;

update public.recipes
set verification_tier = null
where review_status <> 'approved';

alter table public.recipes
  drop constraint if exists recipes_verification_tier_check;

alter table public.recipes
  add constraint recipes_verification_tier_check check (
    verification_tier is null
    or verification_tier in ('editorial_reviewed', 'creator_verified', 'test_kitchen_verified')
  ),
  add constraint recipes_published_verification_required check (
    review_status <> 'approved'
    or (verification_tier is not null and published_at is not null)
  );

create index if not exists recipes_contributor_user_idx
  on public.recipes (contributor_user_id)
  where contributor_user_id is not null;

create index if not exists recipe_versions_created_by_idx
  on public.recipe_versions (created_by)
  where created_by is not null;

create index if not exists recipe_submissions_duplicate_idx
  on public.recipe_submissions (duplicate_of_recipe_id)
  where duplicate_of_recipe_id is not null;

create index if not exists recipe_submissions_promoted_idx
  on public.recipe_submissions (promoted_recipe_id)
  where promoted_recipe_id is not null;

comment on column public.recipes.verification_tier is
  'Null while private/draft; assigned only by the guarded catalogue review function when approved.';
