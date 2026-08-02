create index if not exists parfums_top_rated
  on public.parfums (rating_score desc, review_count desc)
  where rating_score is not null
    and review_count >= 50
    and image_url is not null;
