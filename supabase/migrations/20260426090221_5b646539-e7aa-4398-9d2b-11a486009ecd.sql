
CREATE OR REPLACE FUNCTION public.is_public_email_domain(_domain text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(_domain) IN (
    'gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com',
    'yahoo.com','yahoo.co.uk','yahoo.co.il','ymail.com','rocketmail.com',
    'icloud.com','me.com','mac.com','aol.com','aim.com',
    'proton.me','protonmail.com','pm.me',
    'gmx.com','gmx.de','gmx.net','mail.com','zoho.com','yandex.com','yandex.ru',
    'walla.com','walla.co.il','nana10.co.il','012.net.il','bezeqint.net'
  );
$$;
