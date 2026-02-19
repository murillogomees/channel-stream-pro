/**
 * Hook para verificar e registrar aceite de documentos legais
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ActiveDocuments {
  termsVersion: string | null;
  privacyVersion: string | null;
}

export function useLegalAcceptance() {
  const { user } = useAuth();
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [activeDocuments, setActiveDocuments] = useState<ActiveDocuments>({ termsVersion: null, privacyVersion: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    checkAcceptance();
  }, [user?.id]);

  async function checkAcceptance() {
    setLoading(true);
    try {
      // Get active document versions
      const { data: docs } = await supabase
        .from("legal_documents")
        .select("type, version")
        .eq("is_active", true);

      if (!docs || docs.length === 0) {
        setLoading(false);
        return;
      }

      const termsDoc = docs.find(d => d.type === "terms");
      const privacyDoc = docs.find(d => d.type === "privacy");
      setActiveDocuments({
        termsVersion: termsDoc?.version || null,
        privacyVersion: privacyDoc?.version || null,
      });

      // Check user's acceptances
      const { data: acceptances } = await supabase
        .from("user_legal_acceptance")
        .select("document_type, document_version")
        .eq("user_id", user!.id);

      const acceptedTerms = acceptances?.find(
        a => a.document_type === "terms" && a.document_version === termsDoc?.version
      );
      const acceptedPrivacy = acceptances?.find(
        a => a.document_type === "privacy" && a.document_version === privacyDoc?.version
      );

      setNeedsAcceptance(!acceptedTerms || !acceptedPrivacy);
    } catch (err) {
      console.error("Error checking legal acceptance:", err);
    } finally {
      setLoading(false);
    }
  }

  const recordAcceptance = useCallback(async () => {
    if (!user?.id) return false;

    const inserts: any[] = [];
    if (activeDocuments.termsVersion) {
      inserts.push({
        user_id: user.id,
        document_type: "terms",
        document_version: activeDocuments.termsVersion,
        ip_address: null,
        user_agent: navigator.userAgent,
      });
    }
    if (activeDocuments.privacyVersion) {
      inserts.push({
        user_id: user.id,
        document_type: "privacy",
        document_version: activeDocuments.privacyVersion,
        ip_address: null,
        user_agent: navigator.userAgent,
      });
    }

    if (inserts.length === 0) return true;

    const { error } = await supabase.from("user_legal_acceptance").insert(inserts);
    if (!error) {
      setNeedsAcceptance(false);
      return true;
    }
    return false;
  }, [user?.id, activeDocuments]);

  return { needsAcceptance, activeDocuments, loading, recordAcceptance, checkAcceptance };
}
