import { supabase, Visitor } from './supabase';

/**
 * Normalise un numéro de téléphone en ne conservant que les chiffres.
 * Gère les indicatifs pays comme +225.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Extrait les chiffres significatifs d'un numéro de téléphone (en enlevant les préfixes pays éventuels comme 225 ou 00225)
 */
export function getPhoneCoreDigits(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  
  // Si le numéro commence par 00225, enlever le 00225
  if (digits.startsWith('00225') && digits.length > 5) {
    return digits.slice(5);
  }
  // Si le numéro commence par 225 et a plus de 10 chiffres (ex: 2250701020304 -> 13 chiffres)
  if (digits.startsWith('225') && digits.length >= 11) {
    return digits.slice(3);
  }
  // En Côte d'Ivoire les numéros sont passés à 10 chiffres (ex: 07 01 02 03 04)
  return digits;
}

/**
 * Supprime les accents et met en minuscules pour comparaison insensible à la casse et aux diacritiques.
 */
export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Vérifie si un visiteur correspond à une chaîne de recherche (recherche multi-mots, inversée, téléphone, entreprise, email).
 */
export function matchVisitorLocally(visitor: Visitor, rawQuery: string): boolean {
  const query = normalizeText(rawQuery);
  if (!query) return true;

  const queryDigits = normalizePhone(rawQuery);
  const vPhoneDigits = normalizePhone(visitor.phone);
  const vCorePhone = getPhoneCoreDigits(visitor.phone);

  // 1. Recherche par numéro de téléphone
  if (queryDigits.length >= 3) {
    if (vPhoneDigits.includes(queryDigits) || (queryDigits.length >= 4 && vCorePhone.includes(queryDigits))) {
      return true;
    }
  }

  // 2. Découpage en mots-clés (ex: "KOUASSI Jean" -> ["kouassi", "jean"])
  const tokens = query.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return true;

  const firstNameNorm = normalizeText(visitor.first_name);
  const lastNameNorm = normalizeText(visitor.last_name);
  const fullNameNorm = `${firstNameNorm} ${lastNameNorm}`;
  const reverseFullNameNorm = `${lastNameNorm} ${firstNameNorm}`;
  const companyNorm = normalizeText(visitor.company);
  const emailNorm = normalizeText(visitor.email);
  const notesNorm = normalizeText(visitor.notes);

  // Le visiteur doit valider TOUS les mots-clés de la recherche
  return tokens.every((token) => {
    return (
      firstNameNorm.includes(token) ||
      lastNameNorm.includes(token) ||
      fullNameNorm.includes(token) ||
      reverseFullNameNorm.includes(token) ||
      companyNorm.includes(token) ||
      emailNorm.includes(token) ||
      notesNorm.includes(token)
    );
  });
}

/**
 * Recherche avancée de visiteurs sur Supabase avec tolérance sur l'ordre prénom/nom,
 * téléphones avec espaces ou indicatifs, et recherche par mot-clé.
 */
export async function searchVisitorsServer(query: string, limit: number = 30): Promise<Visitor[]> {
  const rawTerm = query.trim();
  if (!rawTerm) {
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  const digits = normalizePhone(rawTerm);
  const coreDigits = getPhoneCoreDigits(rawTerm);
  const tokens = rawTerm.split(/\s+/).filter((t) => t.length > 0);

  // Construction des filtres OR pour Supabase
  const orConditions: string[] = [];

  // 1. Recherche sur le terme complet échappé
  const escapedFull = rawTerm.replace(/[%_,]/g, ' ').trim();
  if (escapedFull) {
    orConditions.push(`first_name.ilike.%${escapedFull}%`);
    orConditions.push(`last_name.ilike.%${escapedFull}%`);
    orConditions.push(`company.ilike.%${escapedFull}%`);
    orConditions.push(`email.ilike.%${escapedFull}%`);
  }

  // 2. Si plusieurs mots (ex: "Kouassi Jean"), on ajoute chaque token
  tokens.forEach((token) => {
    const escapedToken = token.replace(/[%_,]/g, ' ').trim();
    if (escapedToken.length >= 2) {
      orConditions.push(`first_name.ilike.%${escapedToken}%`);
      orConditions.push(`last_name.ilike.%${escapedToken}%`);
      orConditions.push(`company.ilike.%${escapedToken}%`);
    }
  });

  // 3. Recherche par numéro de téléphone (avec les chiffres clés)
  if (digits.length >= 4) {
    orConditions.push(`phone.ilike.%${digits}%`);
    if (coreDigits !== digits && coreDigits.length >= 4) {
      orConditions.push(`phone.ilike.%${coreDigits}%`);
    }
    // Derniers 8 chiffres (fréquent en CI avec/sans préfixe réseau)
    if (digits.length >= 8) {
      orConditions.push(`phone.ilike.%${digits.slice(-8)}%`);
    }
  }

  // Exécution de la requête Supabase
  let dbQuery = supabase.from('visitors').select('*');
  if (orConditions.length > 0) {
    dbQuery = dbQuery.or(orConditions.join(','));
  }

  const { data, error } = await dbQuery.order('created_at', { ascending: false }).limit(limit * 2);
  if (error || !data) {
    console.error('Erreur recherche visiteurs Supabase:', error);
    return [];
  }

  // Affinage et tri côté client avec matchVisitorLocally pour un score de pertinence parfait
  const filtered = data.filter((v) => matchVisitorLocally(v, rawTerm));
  
  // Si le filtrage local est trop strict, on retourne data, sinon les résultats filtrés
  const results = filtered.length > 0 ? filtered : data;
  return results.slice(0, limit);
}

/**
 * Recherche intelligente d'un doublon visiteur existant avant création ou lors de la saisie.
 * Détecte les correspondances par téléphone (formats variés), nom exact, nom inversé, ou quasi-identique.
 */
export async function findMatchingVisitor(params: {
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): Promise<Visitor | null> {
  const cleanPhone = normalizePhone(params.phone);
  const corePhone = getPhoneCoreDigits(params.phone);
  const firstName = (params.first_name || '').trim();
  const lastName = (params.last_name || '').trim();
  const email = (params.email || '').trim().toLowerCase();

  // 1. Détection par email si fourni
  if (email && email.includes('@')) {
    const { data: emailMatches } = await supabase
      .from('visitors')
      .select('*')
      .ilike('email', email)
      .limit(1);
    if (emailMatches && emailMatches.length > 0) {
      return emailMatches[0];
    }
  }

  // 2. Détection par numéro de téléphone (au moins 6 chiffres)
  if (cleanPhone.length >= 6) {
    // Tester avec les 8 derniers chiffres
    const subDigits = cleanPhone.slice(-8);
    const { data: phoneMatches } = await supabase
      .from('visitors')
      .select('*')
      .or(`phone.ilike.%${subDigits}%,phone.ilike.%${cleanPhone}%,phone.ilike.%${corePhone}%`)
      .limit(10);

    if (phoneMatches && phoneMatches.length > 0) {
      // Vérifier le match par chiffres réels
      for (const candidate of phoneMatches) {
        const cPhoneDigits = normalizePhone(candidate.phone);
        if (
          cPhoneDigits.includes(subDigits) ||
          cPhoneDigits === cleanPhone ||
          cPhoneDigits.endsWith(subDigits) ||
          cleanPhone.endsWith(cPhoneDigits.slice(-8))
        ) {
          return candidate;
        }
      }
    }
  }

  // 3. Détection par nom complet (dans le bon ordre ou dans l'ordre inversé)
  if (firstName.length >= 2 && lastName.length >= 2) {
    // Cas 1: first_name == firstName et last_name == lastName
    const { data: directMatches } = await supabase
      .from('visitors')
      .select('*')
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .limit(1);

    if (directMatches && directMatches.length > 0) {
      return directMatches[0];
    }

    // Cas 2: Inversion Nom / Prénom (très fréquent en saisie)
    const { data: inverseMatches } = await supabase
      .from('visitors')
      .select('*')
      .ilike('first_name', lastName)
      .ilike('last_name', firstName)
      .limit(1);

    if (inverseMatches && inverseMatches.length > 0) {
      return inverseMatches[0];
    }
  }

  // 4. Recherche par combinaison avec normalisation d'accents
  if (firstName.length >= 2 && lastName.length >= 2) {
    const searchCombined = `${firstName} ${lastName}`;
    const candidates = await searchVisitorsServer(searchCombined, 10);
    const fnNorm = normalizeText(firstName);
    const lnNorm = normalizeText(lastName);

    for (const c of candidates) {
      const cFn = normalizeText(c.first_name);
      const cLn = normalizeText(c.last_name);
      
      // Match direct ou inversé sans accents
      if (
        (cFn === fnNorm && cLn === lnNorm) ||
        (cFn === lnNorm && cLn === fnNorm) ||
        (`${cFn} ${cLn}` === `${fnNorm} ${lnNorm}`) ||
        (`${cLn} ${cFn}` === `${fnNorm} ${lnNorm}`)
      ) {
        return c;
      }
    }
  }

  return null;
}
