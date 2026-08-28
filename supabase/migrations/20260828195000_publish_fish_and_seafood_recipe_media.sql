do $$
declare v_reviewer uuid; v_media record; v_recipe public.recipes; v_snapshot jsonb;
begin
  select id into v_reviewer from auth.users where raw_app_meta_data->>'role'='admin' order by created_at limit 1;
  if v_reviewer is null then raise exception 'A founder/admin account is required'; end if;
  for v_media in select * from (values
    ('fish-and-seafood-mustard-salmon-potato-plates','fish-and-seafood-mustard-salmon-potato-plates','Mustard Salmon Potato Plates','catalogue/fish-and-seafood-mustard-salmon-potato-plates.jpg'),
    ('fish-and-seafood-lemon-cod-couscous-plates','fish-and-seafood-lemon-cod-couscous-plates','Lemon Cod Couscous Plates','catalogue/fish-and-seafood-lemon-cod-couscous-plates.jpg'),
    ('fish-and-seafood-prawn-broccoli-rice-stir-fry','fish-and-seafood-prawn-broccoli-noodle-stir-fry','Prawn Broccoli Noodle Stir-Fry','catalogue/fish-and-seafood-prawn-broccoli-noodle-stir-fry.jpg'),
    ('fish-and-seafood-tuna-tomato-pasta','fish-and-seafood-tuna-tomato-pasta','Tuna Tomato Pasta','catalogue/fish-and-seafood-tuna-tomato-pasta.jpg'),
    ('fish-and-seafood-mackerel-cucumber-potato-bowls','fish-and-seafood-mackerel-cucumber-potato-bowls','Mackerel Cucumber Potato Bowls','catalogue/fish-and-seafood-mackerel-cucumber-potato-bowls.jpg'),
    ('fish-and-seafood-salmon-spinach-coconut-curry','fish-and-seafood-salmon-spinach-coconut-curry','Salmon Spinach Coconut Curry','catalogue/fish-and-seafood-salmon-spinach-coconut-curry.jpg'),
    ('fish-and-seafood-cod-chickpea-tomato-stew','fish-and-seafood-cod-chickpea-tomato-stew','Cod Chickpea Tomato Stew','catalogue/fish-and-seafood-cod-chickpea-tomato-stew.jpg'),
    ('fish-and-seafood-prawn-pea-couscous-bowls','fish-and-seafood-prawn-pea-couscous-bowls','Prawn Pea Couscous Bowls','catalogue/fish-and-seafood-prawn-pea-couscous-bowls.jpg'),
    ('fish-and-seafood-tuna-sweetcorn-rice-pot','fish-and-seafood-tuna-sweetcorn-rice-pot','Tuna Sweetcorn Rice Pot','catalogue/fish-and-seafood-tuna-sweetcorn-rice-pot.jpg'),
    ('fish-and-seafood-salmon-broccoli-traybake','fish-and-seafood-salmon-broccoli-traybake','Salmon Broccoli Traybake','catalogue/fish-and-seafood-salmon-broccoli-traybake.jpg'),
    ('fish-and-seafood-mackerel-tomato-wholewheat-pasta','fish-and-seafood-mackerel-tomato-wholewheat-pasta','Mackerel Tomato Wholewheat Pasta','catalogue/fish-and-seafood-mackerel-tomato-wholewheat-pasta.jpg')
  ) m(lookup_slug,published_slug,published_title,storage_path) loop
    select * into v_recipe from public.recipes where slug=v_media.lookup_slug for update;
    if not found or v_recipe.review_status<>'approved' or v_recipe.image_path is not null then raise exception 'Recipe media gate failed: %',v_media.lookup_slug; end if;
    update public.recipes set content_version=content_version+1,slug=v_media.published_slug,title=v_media.published_title,
      dedupe_hash=case when v_media.lookup_slug='fish-and-seafood-prawn-broccoli-rice-stir-fry' then 'e2467cc8b9bb1cace0cef1785a0862ce408017c5838296c61cbf3d34f29764dd' else dedupe_hash end,
      image_path=v_media.storage_path,media_attribution=jsonb_build_object('ai_generated',true,'style_version','kitchen-companion-editorial-v1','provider','OpenAI image generation','model','Built-in image generation; model identifier not exposed','generated_at','2026-08-28T19:50:00Z','prompt_manifest','catalogue/media/fish-and-seafood-images.json','review_status','editorial_reviewed','reviewer_user_id',v_reviewer),updated_at=now()
      where id=v_recipe.id returning * into v_recipe;
    insert into public.recipe_reviews(recipe_id,content_version,reviewer_user_id,decision,checklist,notes) values(v_recipe.id,v_recipe.content_version,v_reviewer,'approved',jsonb_build_object('rights_confirmed',true,'allergens_checked',true,'nutrition_source_checked',true,'ingredient_quantities_checked',true,'recipe_tested',false,'title_ingredient_match_checked',true,'media_recipe_match_checked',true,'media_provenance_recorded',true),'Founder-approved editorial image; visible ingredients checked. Test-kitchen verification is not claimed.');
    select to_jsonb(v_recipe)||jsonb_build_object('ingredients',coalesce((select jsonb_agg(to_jsonb(i) order by i.position) from public.recipe_ingredients i where i.recipe_id=v_recipe.id),'[]'::jsonb)) into v_snapshot;
    insert into public.recipe_versions(recipe_id,content_version,snapshot,verification_tier,created_by) values(v_recipe.id,v_recipe.content_version,v_snapshot,v_recipe.verification_tier,v_reviewer);
    update public.meal_plans set title=v_recipe.title,image=v_recipe.image_path where plan_kind='catalogue' and recipe_id=v_recipe.id::text;
  end loop;
  update public.recipe_books b set cover_path=(select r.image_path from public.recipe_book_recipes l join public.recipes r on r.id=l.recipe_id where l.recipe_book_id=b.id and r.image_path is not null order by l.position limit 1),content_version=content_version+1,updated_at=now() where b.cover_path is null and exists(select 1 from public.recipe_book_recipes l join public.recipes r on r.id=l.recipe_id where l.recipe_book_id=b.id and r.image_path is not null);
end $$;
