import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, Visit, Invoice, Comment, VisitFollowUp, Service, ServiceItem, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCompanySettings } from '../contexts/CompanySettingsContext';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Building2,
  Calendar,
  User,
  Phone,
  Mail,
  CheckCircle,
  Edit,
  FileText,
  CreditCard,
  MessageSquare,
  Send,
  Plus,
  ShieldAlert,
  Trash2,
  MapPin,
  Loader2,
} from 'lucide-react';

export default function VisitDetailPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { settings } = useCompanySettings();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [followUps, setFollowUps] = useState<VisitFollowUp[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [treatmentObservations, setTreatmentObservations] = useState('');
  const [treatmentReport, setTreatmentReport] = useState('');
  const [closingStatus, setClosingStatus] = useState('traite');
  const [savingTreatment, setSavingTreatment] = useState(false);
  
  // Attachments and Access control states
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lawyers, setLawyers] = useState<Profile[]>([]);
  const [visitAccessUserIds, setVisitAccessUserIds] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  // Billing and Payment states
  const [catalogItems, setCatalogItems] = useState<ServiceItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<{ item: ServiceItem; quantity: number }[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState(0);

  const [invoiceForm, setInvoiceForm] = useState({
    is_billable: false,
    amount: 0,
    expected_duration_days: 7,
    responsible_service_id: '',
  });

  const [followUpForm, setFollowUpForm] = useState({
    status: 'pending',
    priority: 'normal',
    due_date: '',
    note: '',
  });

  useEffect(() => {
    fetchVisit();
    fetchServices();
  }, [id]);

  useEffect(() => {
    const fetchCatalog = async () => {
      if (showInvoiceForm) {
        const { data } = await supabase
          .from('service_items')
          .select('*, service:services(name)')
          .eq('is_active', true)
          .order('name');
        if (data) {
          const formatted = data.map(item => ({
            ...item,
            name: (item as any).service ? `${item.name} (${(item as any).service.name})` : item.name
          }));
          setCatalogItems(formatted);
        }
      }
    };
    fetchCatalog();
  }, [showInvoiceForm]);

  const fetchVisit = async () => {
    setLoading(true);
    const { data: visitData } = await supabase
      .from('visits')
      .select(
        `
        *,
        visitor:visitors(*),
        service:services(*),
        assigned_collaborator:profiles!visits_assigned_collaborator_id_fkey(id, full_name, role)
      `
      )
      .eq('id', id)
      .single();

    if (visitData) {
      setVisit(visitData);
      setTreatmentObservations(visitData.observations || '');
      setTreatmentReport(visitData.report || '');
      setAttachments(visitData.attachments || []);
      if (visitData.status === 'en_cours' || visitData.status === 'in_progress') {
        setClosingStatus('traite');
      } else {
        setClosingStatus(visitData.status);
      }

      // Fetch invoice
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('*')
        .eq('visit_id', id)
        .single();
      
      if (invoiceData) {
        setInvoice(invoiceData);
        setInvoiceForm({
          is_billable: invoiceData.is_billable,
          amount: Number(invoiceData.amount),
          expected_duration_days: invoiceData.expected_duration_days || 7,
          responsible_service_id: invoiceData.responsible_service_id || '',
        });

        // Fetch invoice items
        const { data: invItems } = await supabase
          .from('invoice_items')
          .select(`*, service_item:service_items(*)`)
          .eq('invoice_id', invoiceData.id);
        
        if (invItems) {
          const formatted = invItems.map((ii: any) => {
            if (ii.service_item) {
              return {
                item: ii.service_item,
                quantity: ii.quantity
              };
            } else {
              return {
                item: {
                  id: ii.id,
                  name: ii.custom_name || 'Prestation personnalisée',
                  price: Number(ii.unit_price),
                  is_custom: true
                },
                quantity: ii.quantity
              };
            }
          });
          setSelectedItems(formatted as any);
        }
      } else {
        setInvoice(null);
        setSelectedItems([]);
      }

      // Fetch follow-ups
      const { data: followUpsData } = await supabase
        .from('visit_followups')
        .select('*')
        .eq('visit_id', id)
        .order('created_at', { ascending: false });
      if (followUpsData) setFollowUps(followUpsData);

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('comments')
        .select(`*, profile:profiles(*)`)
        .eq('visit_id', id)
        .order('created_at', { ascending: true });
      if (commentsData) setComments(commentsData);

      // Fetch visit access details and lawyers
      const { data: accessData } = await supabase
        .from('visit_access')
        .select('user_id')
        .eq('visit_id', id);
      if (accessData) {
        setVisitAccessUserIds(accessData.map((a: any) => a.user_id));
      }

      const { data: lawyersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'lawyer')
        .eq('is_active', true);
      if (lawyersData) setLawyers(lawyersData);
    }
    setLoading(false);
  };

  const handleTakeCharge = async () => {
    if (!visit || !profile || !user) return;
    setSavingTreatment(true);
    const { error } = await supabase
      .from('visits')
      .update({
        assigned_collaborator_id: profile.id,
        status: 'en_cours',
        updated_at: new Date().toISOString()
      })
      .eq('id', visit.id);

    if (!error) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'TAKE_CHARGE',
        entity_type: 'visit',
        entity_id: visit.id,
        details: { collaborator: profile.full_name },
      });

      await supabase.from('comments').insert({
        visit_id: visit.id,
        user_id: user.id,
        content: `💼 Visite prise en charge par ${profile.full_name}. Statut mis en entretien.`,
      });
      fetchVisit();
    } else {
      alert("Erreur lors de la prise en charge : " + error.message);
    }
    setSavingTreatment(false);
  };

  const handleSaveObservations = async () => {
    if (!visit) return;
    setSavingTreatment(true);
    const { error } = await supabase
      .from('visits')
      .update({
        observations: treatmentObservations,
        updated_at: new Date().toISOString()
      })
      .eq('id', visit.id);

    if (!error) {
      alert("Observations enregistrées avec succès !");
      fetchVisit();
    } else {
      alert("Erreur lors de l'enregistrement : " + error.message);
    }
    setSavingTreatment(false);
  };

  const handleCloseVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit || !profile || !user) return;
    if (!treatmentReport.trim()) {
      alert("Le compte rendu final est obligatoire pour clôturer la visite.");
      return;
    }

    setSavingTreatment(true);
    const { error } = await supabase
      .from('visits')
      .update({
        status: closingStatus as any,
        report: treatmentReport.trim(),
        observations: treatmentObservations.trim(),
        departure_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', visit.id);

    if (!error) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'CLOSE_VISIT',
        entity_type: 'visit',
        entity_id: visit.id,
        details: { status: closingStatus, collaborator: profile.full_name },
      });

      await supabase.from('comments').insert({
        visit_id: visit.id,
        user_id: user.id,
        content: `✅ Visite clôturée (${closingStatus === 'traite' ? 'Traité' : closingStatus === 'a_relancer' ? 'À relancer' : closingStatus === 'transforme' ? 'Transformé' : 'Terminé'}) par ${profile.full_name}. Compte-rendu fourni.`,
      });
      fetchVisit();
    } else {
      alert("Erreur lors de la clôture de la visite : " + error.message);
    }
    setSavingTreatment(false);
  };

  const handleReleaseCharge = async () => {
    if (!visit || !user) return;
    setSavingTreatment(true);
    const { error } = await supabase
      .from('visits')
      .update({
        assigned_collaborator_id: null,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', visit.id);

    if (!error) {
      await supabase.from('comments').insert({
        visit_id: visit.id,
        user_id: user.id,
        content: `🔄 Prise en charge abandonnée. La visite est retournée dans la file d'attente générale.`,
      });
      fetchVisit();
    } else {
      alert("Erreur lors de la libération : " + error.message);
    }
    setSavingTreatment(false);
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) setServices(data);
  };

  const handleMarkDeparture = async () => {
    if (!visit) return;
    await supabase
      .from('visits')
      .update({ departure_time: new Date().toISOString(), status: 'completed' })
      .eq('id', visit.id);
    fetchVisit();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    await supabase.from('comments').insert({
      visit_id: id,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment('');
    fetchVisit();
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit) return;

    // Calculate total amount from selected items if billable
    const totalAmount = invoiceForm.is_billable
      ? selectedItems.reduce((sum, current) => sum + current.item.price * current.quantity, 0)
      : 0;

    let invoiceId = invoice?.id;

    const invoiceData = {
      visit_id: visit.id,
      is_billable: invoiceForm.is_billable,
      amount: totalAmount,
      expected_duration_days: invoiceForm.expected_duration_days,
      responsible_service_id: invoiceForm.responsible_service_id || null,
      deadline: invoiceForm.responsible_service_id
        ? new Date(Date.now() + invoiceForm.expected_duration_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null,
    };

    if (invoiceId) {
      // Update existing invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          ...invoiceData,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);
      
      if (updateError) {
        console.error(updateError);
        return;
      }
      
      // Delete old invoice items
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
    } else {
      // Insert new invoice
      const { data: newInv, error: insertError } = await supabase
        .from('invoices')
        .insert({
          ...invoiceData,
          amount_paid: 0,
          payment_status: 'not_invoiced',
          service_status: 'pending',
        })
        .select()
        .single();
      
      if (insertError) {
        console.error(insertError);
        return;
      }
      invoiceId = newInv.id;
    }

    // Insert invoice items if billable
    if (invoiceForm.is_billable && selectedItems.length > 0) {
      const itemsToInsert = selectedItems.map((si) => {
        if ((si.item as any).is_custom) {
          return {
            invoice_id: invoiceId,
            service_item_id: null,
            custom_name: si.item.name,
            quantity: si.quantity,
            unit_price: si.item.price,
            total_price: si.item.price * si.quantity,
          };
        } else {
          return {
            invoice_id: invoiceId,
            service_item_id: si.item.id,
            custom_name: null,
            quantity: si.quantity,
            unit_price: si.item.price,
            total_price: si.item.price * si.quantity,
          };
        }
      });

      await supabase.from('invoice_items').insert(itemsToInsert);
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user?.id,
      action: invoice ? 'UPDATE_INVOICE' : 'CREATE_INVOICE',
      entity_type: 'invoice',
      entity_id: invoiceId,
      details: { amount: totalAmount },
    });

    setShowInvoiceForm(false);
    fetchVisit();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !user) return;

    const newPaid = Number(invoice.amount_paid) + paymentAmount;
    const isPaid = newPaid >= Number(invoice.amount);
    const paymentStatus = isPaid ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'invoiced');

    const { error } = await supabase
      .from('invoices')
      .update({
        amount_paid: newPaid,
        payment_status: paymentStatus,
        invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (!error) {
      // Log payment activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'RECORD_PAYMENT',
        entity_type: 'invoice',
        entity_id: invoice.id,
        details: { amountPaid: paymentAmount, totalPaid: newPaid },
      });
      
      // Auto-create a comment indicating the payment
      await supabase.from('comments').insert({
        visit_id: id,
        user_id: user.id,
        content: `💳 Encaissement enregistré : ${paymentAmount.toLocaleString('fr-FR')} XOF versés. Nouveau solde payé : ${newPaid.toLocaleString('fr-FR')} XOF / ${Number(invoice.amount).toLocaleString('fr-FR')} XOF.`,
      });
    }

    setShowPaymentModal(false);
    setPaymentAmount(0);
    fetchVisit();
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('visit_followups').insert({
      visit_id: id,
      status: followUpForm.status,
      priority: followUpForm.priority,
      due_date: followUpForm.due_date || null,
    });

    setShowFollowUpForm(false);
    fetchVisit();
  };

  const getVisitorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      client: 'Client',
      prospect: 'Prospect',
      supplier: 'Fournisseur',
      partner: 'Partenaire',
      other: 'Autre',
    };
    return labels[type] || type;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      director: 'Directeur Général',
      reception: 'Réception / Secrétariat',
      service_manager: 'Responsable Service',
      accounting: 'Comptabilité',
      cashier: 'Caissier / Caisse',
      collaborator: 'Collaborateur',
      nurse: 'Infirmier',
      lawyer: 'Juriste Externe',
    };
    return labels[role] || role;
  };

  const getStatusBadge = (status: string) => {
    const config = {
      in_progress: { label: 'En attente', class: 'badge-info', dot: 'dot-pulse-primary' },
      en_cours: { label: 'En entretien', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/20', dot: 'bg-amber-500 animate-pulse' },
      traite: { label: 'Traité', class: 'badge-success', dot: 'dot-pulse-success' },
      a_relancer: { label: 'À relancer', class: 'bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/20', dot: 'bg-rose-500 animate-pulse' },
      transforme: { label: 'Opportunité', class: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200/20', dot: 'bg-indigo-500 animate-pulse' },
      completed: { label: 'Terminé', class: 'badge-success', dot: 'dot-pulse-success' },
      cancelled: { label: 'Annulé', class: 'badge-danger', dot: 'dot-pulse-danger' },
      annule: { label: 'Annulé', class: 'badge-danger', dot: 'dot-pulse-danger' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray', dot: 'bg-slate-400' };
    
    return (
      <span className={`${current.class} flex items-center gap-1.5`}>
        <span className={`${current.dot} w-2 h-2 rounded-full`} />
        {current.label}
      </span>
    );
  };

  const hasAttachmentAccess = (): boolean => {
    if (!profile || !visit) return false;
    
    // Admin, Director, Reception can always view attachments
    if (['admin', 'director', 'reception'].includes(profile.role)) {
      return true;
    }
    
    // Creator or assignee can view attachments
    if (visit.created_by === profile.id || visit.assigned_collaborator_id === profile.id) {
      return true;
    }
    
    // If visibility is public to all, standard collaborators (not lawyers) can view
    if (visit.attachments_visible_to_all && profile.role !== 'lawyer') {
      return true;
    }
    
    // Lawyers or other users check visit_access
    if (visitAccessUserIds.includes(profile.id)) {
      return true;
    }

    return false;
  };

  const handleToggleVisibility = async () => {
    if (!visit || !profile) return;
    setTogglingVisibility(true);
    const newValue = !visit.attachments_visible_to_all;
    
    const { error } = await supabase
      .from('visits')
      .update({ attachments_visible_to_all: newValue })
      .eq('id', visit.id);
      
    if (!error) {
      setVisit(prev => prev ? { ...prev, attachments_visible_to_all: newValue } : null);
      
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'TOGGLE_ATTACHMENT_VISIBILITY',
        entity_type: 'visit',
        entity_id: visit.id,
        details: { attachments_visible_to_all: newValue },
      });
      
      await supabase.from('comments').insert({
        visit_id: visit.id,
        user_id: user?.id,
        content: `🔒 Les pièces jointes sont désormais ${newValue ? 'PUBLIQUES (visibles par tous)' : 'PRIVÉES (accès restreint)'}.`,
      });
      
      fetchVisit();
    } else {
      alert("Erreur lors de la modification de la visibilité: " + error.message);
    }
    setTogglingVisibility(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !visit) return;
    setUploading(true);

    const newAttachments = [...attachments];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `visit-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) {
        alert(`Erreur d'upload: ${uploadError.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      if (publicUrl) {
        newAttachments.push(publicUrl);
      }
    }

    const { error: updateError } = await supabase
      .from('visits')
      .update({ attachments: newAttachments })
      .eq('id', visit.id);

    if (!updateError) {
      setAttachments(newAttachments);
      
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'UPLOAD_ATTACHMENT',
        entity_type: 'visit',
        entity_id: visit.id,
        details: { count: files.length },
      });
      
      await supabase.from('comments').insert({
        visit_id: visit.id,
        user_id: user?.id,
        content: `📎 ${files.length} pièce(s) jointe(s) ajoutée(s).`,
      });
      
      fetchVisit();
    } else {
      alert("Erreur lors de la mise à jour des pièces jointes : " + updateError.message);
    }

    setUploading(false);
  };

  const removeAttachment = async (indexToRemove: number) => {
    if (!visit) return;
    const newAttachments = attachments.filter((_, idx) => idx !== indexToRemove);

    const { error: updateError } = await supabase
      .from('visits')
      .update({ attachments: newAttachments })
      .eq('id', visit.id);

    if (!updateError) {
      setAttachments(newAttachments);
      
      await supabase.from('comments').insert({
        visit_id: visit.id,
        user_id: user?.id,
        content: `🗑️ Une pièce jointe a été supprimée.`,
      });
      
      fetchVisit();
    } else {
      alert("Erreur lors de la suppression : " + updateError.message);
    }
  };

  const handleToggleLawyerAccess = async (lawyerId: string) => {
    if (!visit) return;
    setSavingAccess(true);
    
    const isGranted = visitAccessUserIds.includes(lawyerId);
    
    if (isGranted) {
      const { error } = await supabase
        .from('visit_access')
        .delete()
        .eq('visit_id', visit.id)
        .eq('user_id', lawyerId);
        
      if (!error) {
        setVisitAccessUserIds(prev => prev.filter(id => id !== lawyerId));
        
        const lawyerName = lawyers.find(l => l.id === lawyerId)?.full_name || 'Juriste';
        await supabase.from('comments').insert({
          visit_id: visit.id,
          user_id: user?.id,
          content: `🔏 Accès au dossier révoqué pour le juriste ${lawyerName}.`,
        });
      } else {
        alert("Erreur de révocation : " + error.message);
      }
    } else {
      const { error } = await supabase
        .from('visit_access')
        .insert({
          visit_id: visit.id,
          user_id: lawyerId,
          granted_by: user?.id
        });
        
      if (!error) {
        setVisitAccessUserIds(prev => [...prev, lawyerId]);
        
        const lawyerName = lawyers.find(l => l.id === lawyerId)?.full_name || 'Juriste';
        await supabase.from('comments').insert({
          visit_id: visit.id,
          user_id: user?.id,
          content: `🔑 Accès au dossier accordé au juriste ${lawyerName}.`,
        });
      } else {
        alert("Erreur d'octroi d'accès : " + error.message);
      }
    }
    setSavingAccess(false);
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      not_invoiced: { label: 'Non facturé', class: 'badge-gray' },
      invoiced: { label: 'Facturé', class: 'badge-info' },
      paid: { label: 'Payé', class: 'badge-success' },
      partially_paid: { label: 'Partiellement payé', class: 'badge-warning' },
      cancelled: { label: 'Annulé', class: 'badge-danger' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={current.class}>{current.label}</span>;
  };

  const getServiceStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', class: 'badge-gray' },
      in_progress: { label: 'En cours', class: 'badge-info' },
      completed: { label: 'Terminé', class: 'badge-success' },
      blocked: { label: 'Bloqué', class: 'badge-danger' },
      late: { label: 'En retard', class: 'badge-warning' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={current.class}>{current.label}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    const config = {
      low: { label: 'Basse', class: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
      normal: { label: 'Normale', class: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
      high: { label: 'Haute', class: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
      urgent: { label: 'Urgente', class: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold' },
    };
    const current = config[priority as keyof typeof config] || { label: priority, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  const canEdit = profile?.role === 'admin' || profile?.role === 'reception' || profile?.role === 'director';
  const canManageInvoice = profile && ['admin', 'director', 'accounting', 'reception', 'service_manager'].includes(profile.role);
  const canManageFollowUp = profile && ['admin', 'director', 'reception', 'service_manager'].includes(profile.role);
  const canTreat = profile && ['admin', 'director', 'service_manager', 'collaborator', 'nurse'].includes(profile.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner h-10 w-10"></div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="card p-12 text-center space-y-4 max-w-md mx-auto mt-12">
        <FileText className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Visite non trouvée</h2>
        <button onClick={() => navigate('/visits')} className="btn-primary w-full">
          Retour au registre
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">{visit.visit_code}</h1>
              {getStatusBadge(visit.status)}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Fiche détaillée</p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex gap-2 shrink-0 no-print">
          {invoice && (
            <button onClick={() => window.print()} className="btn-secondary px-5">
              <FileText className="w-4.5 h-4.5 mr-2" />
              Imprimer Facture / Reçu
            </button>
          )}
          {visit.status === 'in_progress' && canEdit && (
            <button onClick={handleMarkDeparture} className="btn-success px-5">
              <CheckCircle className="w-4.5 h-4.5 mr-2" />
              Enregistrer le départ
            </button>
          )}
          {canEdit && (
            <Link to={`/visits/${id}/edit`} className="btn-secondary px-5">
              <Edit className="w-4.5 h-4.5 mr-2" />
              Modifier
            </Link>
          )}
        </div>
      </div>

      {/* Grid Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details Columns (Left) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Prise en charge & Traitement Collaborateur */}
          {canTreat && (visit.status === 'in_progress' || visit.status === 'en_cours') && (
            <div className="card border-primary-100 dark:border-primary-950/40 bg-gradient-to-br from-white to-primary-50/10 dark:from-slate-900 dark:to-primary-950/5 no-print">
              <div className="card-header flex items-center justify-between">
                <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4.5 h-4.5 text-primary-600" />
                  Prise en charge & Traitement
                </h2>
                {visit.assigned_collaborator && (
                  <span className="badge bg-primary-100 text-primary-700 px-3 py-1 font-bold text-xs rounded-lg">
                    Assignée à {(visit as any).assigned_collaborator?.full_name}
                  </span>
                )}
              </div>
              <div className="card-body space-y-4">
                {!visit.assigned_collaborator_id ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Cette visite est actuellement dans la file d'attente générale et n'est prise en charge par aucun collaborateur.
                    </p>
                    <button
                      type="button"
                      onClick={handleTakeCharge}
                      disabled={savingTreatment}
                      className="btn-primary"
                    >
                      Prendre en charge cette visite
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Only the assigned collaborator or admin/director can edit details */}
                    {(user?.id === visit.assigned_collaborator_id || profile?.role === 'admin' || profile?.role === 'director') ? (
                      <form onSubmit={handleCloseVisit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="label">Observations en cours d'entretien</label>
                            <textarea
                              value={treatmentObservations}
                              onChange={(e) => setTreatmentObservations(e.target.value)}
                              placeholder="Saisissez des notes ou observations en temps réel..."
                              className="input min-h-[80px]"
                            />
                            <div className="flex justify-end mt-1">
                              <button
                                type="button"
                                onClick={handleSaveObservations}
                                disabled={savingTreatment}
                                className="text-xs text-primary-600 hover:underline font-bold"
                              >
                                Sauvegarder les observations
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="label">Compte rendu final (Obligatoire pour clôturer) *</label>
                            <textarea
                              value={treatmentReport}
                              onChange={(e) => setTreatmentReport(e.target.value)}
                              placeholder="Saisissez le compte rendu final de l'entretien..."
                              className="input min-h-[100px]"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="label">Statut de clôture</label>
                              <select
                                value={closingStatus}
                                onChange={(e) => setClosingStatus(e.target.value)}
                                className="input"
                                required
                              >
                                <option value="traite">Traité (Terminé avec succès)</option>
                                <option value="a_relancer">À relancer (Action requise)</option>
                                <option value="transforme">Transformé en opportunité commerciale</option>
                                <option value="completed">Terminé simple</option>
                              </select>
                            </div>
                            <div className="flex items-end gap-2">
                              <button
                                type="submit"
                                disabled={savingTreatment || !treatmentReport.trim()}
                                className="btn-success flex-1 justify-center py-2.5 rounded-xl font-bold shadow-md shadow-emerald-500/10"
                              >
                                Clôturer la visite
                              </button>
                              <button
                                type="button"
                                onClick={handleReleaseCharge}
                                disabled={savingTreatment}
                                className="btn-secondary px-3 py-2.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                                title="Abandonner la prise en charge"
                              >
                                Abandonner
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center text-xs text-slate-500 font-medium">
                        Cette visite est actuellement traitée par <strong>{(visit as any).assigned_collaborator?.full_name}</strong>. Seul ce collaborateur ou un administrateur peut modifier l'entretien.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rapport final de traitement */}
          {['completed', 'traite', 'a_relancer', 'transforme'].includes(visit.status) && (visit.report || visit.observations) && (
            <div className="card border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="card-header">
                <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                  Rapport de Traitement
                </h2>
              </div>
              <div className="card-body space-y-4">
                {visit.assigned_collaborator && (
                  <p className="text-xs font-semibold text-slate-400">
                    Traité par : <strong className="text-slate-700 dark:text-slate-300">{(visit as any).assigned_collaborator.full_name}</strong> ({getRoleLabel((visit as any).assigned_collaborator.role)})
                  </p>
                )}
                {visit.observations && (
                  <div>
                    <p className="label">Observations de l'entretien</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800 leading-relaxed">
                      {visit.observations}
                    </p>
                  </div>
                )}
                {visit.report && (
                  <div>
                    <p className="label">Compte rendu final</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 rounded-xl border border-emerald-100/10 dark:border-emerald-950/30 leading-relaxed font-semibold">
                      {visit.report}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visit Information */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Informations générales</h2>
            </div>
            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <div>
                <p className="label">Motif de visite</p>
                <p className="font-bold text-slate-800 dark:text-white text-base leading-snug">{visit.purpose}</p>
              </div>

              <div>
                <p className="label">Rendez-vous planifié</p>
                <p className="font-semibold text-slate-800 dark:text-white text-sm">
                  {visit.has_appointment ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg border border-emerald-100/10">Oui</span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg">Non</span>
                  )}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="label">Heure d'arrivée</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {format(new Date(visit.arrival_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="label">Heure de départ</p>
                  {visit.departure_time ? (
                    <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {format(new Date(visit.departure_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 italic text-sm">Visite toujours en cours</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="label">Service concerné</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {visit.service?.name || 'Non spécifié'}
                  </p>
                </div>
                <div>
                  <p className="label">Collaborateur à rencontrer</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    {visit.person_to_meet || 'Non renseigné'}
                  </p>
                </div>
                <div>
                  <p className="label">Succursale / Site</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {(visit as any).branch || 'Siège (Bonoua)'}
                  </p>
                </div>
              </div>

              {visit.comments && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2">
                  <p className="label">Observations d'accueil</p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed bg-slate-50/50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 font-medium">{visit.comments}</p>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Section */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-slate-400" />
                Documents & Pièces Jointes
              </h2>
              {hasAttachmentAccess() && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {attachments.length} document(s)
                </span>
              )}
            </div>
            
            <div className="card-body space-y-6">
              {/* Privacy Status & DG/Admin Visibility Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    {visit.attachments_visible_to_all ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        Visibilité Publique Active
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        Accès Confidentiel (Restreint)
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                    {visit.attachments_visible_to_all 
                      ? "Tous les collaborateurs autorisés à voir cette visite peuvent consulter ces documents."
                      : "Seuls l'administrateur, le Directeur Général, l'assistante de direction (réception), le créateur, l'assigné et les juristes autorisés peuvent consulter."}
                  </p>
                </div>

                {profile && ['admin', 'director'].includes(profile.role) && (
                  <button
                    onClick={handleToggleVisibility}
                    disabled={togglingVisibility}
                    className={`btn-secondary text-xs py-2 px-4 flex items-center gap-2 shadow-sm ${
                      visit.attachments_visible_to_all 
                        ? 'border-rose-200/50 dark:border-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20' 
                        : 'border-emerald-200/50 dark:border-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                    }`}
                  >
                    {togglingVisibility ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : visit.attachments_visible_to_all ? (
                      "Rendre Privé"
                    ) : (
                      "Rendre Public pour tous"
                    )}
                  </button>
                )}
              </div>

              {hasAttachmentAccess() ? (
                <>
                  {/* Upload Interface (Authorized users can upload, receptionist, admin, director, assignee, creator) */}
                  {profile && ['admin', 'director', 'reception', visit.created_by, visit.assigned_collaborator_id].includes(profile.role) && (
                    <div>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-2xl cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-4 pb-4">
                            {uploading ? (
                              <Loader2 className="w-7 h-7 text-primary-500 animate-spin" />
                            ) : (
                              <svg className="w-7 h-7 text-slate-400 dark:text-slate-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                              {uploading ? "Téléversement..." : "Cliquez ou glissez-déposez pour ajouter des pièces jointes"}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              PNG, JPG, PDF (Max. 10 Mo)
                            </p>
                          </div>
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Attachment Files List */}
                  {attachments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {attachments.map((url, index) => {
                        const fileName = url.split('/').pop()?.split('_').slice(1).join('_') || `Document_${index + 1}`;
                        const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)/i);

                        return (
                          <div key={index} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-3.5 min-w-0">
                              {isImage ? (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0 cursor-zoom-in">
                                  <img src={url} alt="Aperçu" className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner" />
                                </a>
                              ) : (
                                <div className="w-12 h-12 bg-primary-50 dark:bg-primary-950/40 rounded-xl flex items-center justify-center border border-primary-100/10 flex-shrink-0 shadow-inner">
                                  <span className="text-xs font-bold text-primary-700 dark:text-primary-400">PDF</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{fileName}</p>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary-600 dark:text-primary-400 font-semibold hover:underline mt-0.5 inline-block">
                                  Visualiser le document
                                </a>
                              </div>
                            </div>
                            
                            {profile && ['admin', 'director', 'reception', visit.created_by, visit.assigned_collaborator_id].includes(profile.role) && (
                              <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-450 rounded-xl transition-colors"
                                title="Supprimer ce fichier"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50/30 dark:bg-slate-950/10 rounded-2xl border border-slate-100/80 dark:border-slate-800/40">
                      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">Aucun document joint à cette visite</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                  <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Fichiers Confidentiels</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Les pièces jointes de cette visite sont privées. Seuls les utilisateurs et juristes dûment autorisés peuvent y accéder.
                  </p>
                </div>
              )}

              {/* Access Delegation Panel (Only for DG and Admin) */}
              {profile && ['admin', 'director'].includes(profile.role) && lawyers.length > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                      Délégation d'accès (Juristes de l'entreprise)
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                      Cochez les juristes autorisés à consulter ce dossier client/visiteur en toute confidentialité.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {lawyers.map((lawyer) => {
                      const isGranted = visitAccessUserIds.includes(lawyer.id);
                      return (
                        <label
                          key={lawyer.id}
                          className={`flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border rounded-2xl cursor-pointer hover:shadow-sm transition-all duration-200 select-none ${
                            isGranted 
                              ? 'border-primary-500/50 bg-primary-50/10 dark:bg-primary-950/10' 
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isGranted}
                            disabled={savingAccess}
                            onChange={() => handleToggleLawyerAccess(lawyer.id)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-700 focus:ring-primary-500"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                              {lawyer.full_name}
                            </p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider truncate mt-0.5">
                              {(lawyer as any).branch || 'Siège'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Billing / Invoice Panel */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Facturation & Prestation</h2>
              {!invoice && canManageInvoice && (
                <button onClick={() => setShowInvoiceForm(true)} className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
                  <Plus className="w-4 h-4" /> Configurer facturation
                </button>
              )}
            </div>
            <div className="card-body">
              {invoice ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="label">Assujetti à facturation</p>
                      <p className="font-bold text-slate-800 dark:text-white text-sm">
                        {invoice.is_billable ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-lg border border-amber-100/10">Oui</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg">Non (Gratuit)</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="label">Statut de réalisation</p>
                      {getServiceStatusBadge(invoice.service_status)}
                    </div>
                  </div>

                  {invoice.is_billable && (
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        <p className="label">Montant global</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-white">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(invoice.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="label">Montant versé</p>
                        <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(invoice.amount_paid)}
                        </p>
                      </div>
                      <div>
                        <p className="label">Reste à solder</p>
                        <p className={`text-sm font-extrabold ${Number(invoice.amount) - Number(invoice.amount_paid) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid)))}
                        </p>
                      </div>
                    </div>
                  )}

                  {invoice.is_billable && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                      <p className="label">Statut du paiement</p>
                      <div className="mt-1">{getPaymentStatusBadge(invoice.payment_status)}</div>
                    </div>
                  )}

                  {selectedItems.length > 0 && invoice.is_billable && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                      <p className="label mb-2">Prestations détaillées</p>
                      <div className="space-y-2">
                        {selectedItems.map((si, idx) => (
                          <div key={idx} className="flex justify-between text-xs bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {si.item?.name || 'Prestation'} <span className="text-slate-400">x{si.quantity}</span>
                            </span>
                            <span className="font-bold text-slate-800 dark:text-white">
                              {((si.item?.price || 0) * si.quantity).toLocaleString('fr-FR')} XOF
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {invoice.deadline && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-4">
                      <div>
                        <p className="label">Date d'échéance</p>
                        <p className="font-semibold text-slate-800 dark:text-white text-sm">
                          {format(new Date(invoice.deadline), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      </div>
                      <div>
                        <p className="label">Analyse du délai</p>
                        <p className="font-semibold text-sm">
                          {new Date(invoice.deadline) < new Date() && invoice.service_status !== 'completed' ? (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                              <ShieldAlert className="w-4 h-4" />
                              Échéance dépassée
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Dans les temps</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {invoice.is_billable && invoice.payment_status !== 'paid' && (profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'cashier' || profile?.role === 'director') && (
                    <button
                      onClick={() => {
                        setPaymentAmount(Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid)));
                        setShowPaymentModal(true);
                      }}
                      className="btn-success w-full text-xs justify-center py-2.5 rounded-xl mt-4 shadow-md shadow-emerald-500/10"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Enregistrer un règlement
                    </button>
                  )}

                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-slate-600 space-y-2">
                  <CreditCard className="w-10 h-10 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">Aucune facturation configurée pour cette visite</p>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up Section */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Demandes de suivi de prestation</h2>
              {canManageFollowUp && (
                <button onClick={() => setShowFollowUpForm(true)} className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
                  <Plus className="w-4 h-4" /> Nouveau suivi
                </button>
              )}
            </div>
            <div className="card-body">
              {followUps.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {followUps.map((fu) => (
                    <div key={fu.id} className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {canManageFollowUp ? (
                          <select
                            value={fu.status}
                            onChange={async (e) => {
                              const nextStatus = e.target.value;
                              await supabase
                                .from('visit_followups')
                                .update({
                                  status: nextStatus,
                                  completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
                                  updated_at: new Date().toISOString()
                                })
                                .eq('id', fu.id);
                              fetchVisit();
                            }}
                            className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 outline-none font-semibold text-slate-700 dark:text-slate-300"
                          >
                            <option value="pending">En attente</option>
                            <option value="in_progress">En cours</option>
                            <option value="completed">Terminé</option>
                            <option value="blocked">Bloqué</option>
                            <option value="late">En retard</option>
                          </select>
                        ) : (
                          getServiceStatusBadge(fu.status)
                        )}
                        {getPriorityBadge(fu.priority)}
                      </div>
                      {fu.due_date && (
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-2">
                          Date d'échéance : {format(new Date(fu.due_date), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-slate-600 space-y-2">
                  <CheckCircle className="w-10 h-10 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">Aucun suivi requis pour cette prestation</p>
                </div>
              )}
            </div>
          </div>

          {/* Comments Panel */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-slate-400" />
                Fil de discussion ({comments.length})
              </h2>
            </div>
            <div className="card-body space-y-6">
              
              {comments.length > 0 && (
                <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3.5 items-start">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900 flex items-center justify-center flex-shrink-0 border border-primary-100/10">
                        <User className="w-4.5 h-4.5 text-primary-700 dark:text-primary-400" />
                      </div>
                      
                      <div className="flex-1 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-white">{(c as any).profile?.full_name || 'Collaborateur'}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-normal font-medium">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Écrire une observation ou un message..."
                  className="input flex-1"
                />
                <button type="submit" disabled={!newComment.trim()} className="btn-primary px-4 shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>

            </div>
          </div>

        </div>

        {/* Visitor Info Panel (Right) */}
        <div className="space-y-6">
          
          {/* Visitor Card */}
          <div className="card">
            <div className="card-body space-y-6">
              <div className="text-center space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center mx-auto shadow-md">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
                    {visit.visitor?.first_name} {visit.visitor?.last_name}
                  </h3>
                  {visit.visitor?.company && (
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">{visit.visitor.company}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                
                <div>
                  <p className="label">Profil Visiteur</p>
                  <span className="badge-gray px-3 py-1 font-bold text-xs uppercase tracking-wider">{getVisitorTypeLabel(visit.visitor?.visitor_type || 'other')}</span>
                </div>

                {visit.visitor?.phone && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                    <Phone className="w-4.5 h-4.5 text-slate-400" />
                    <a href={`tel:${visit.visitor.phone}`} className="text-sm font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline">
                      {visit.visitor.phone}
                    </a>
                  </div>
                )}

                {visit.visitor?.email && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                    <Mail className="w-4.5 h-4.5 text-slate-400" />
                    <a href={`mailto:${visit.visitor.email}`} className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline truncate">
                      {visit.visitor.email}
                    </a>
                  </div>
                )}
                
              </div>
            </div>
          </div>

          {/* Quick Actions inside visitor sidebar */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider">Prestation & Preuve</h3>
            <div className="space-y-2">
              {canManageInvoice && invoice && (
                <button 
                  onClick={() => setShowInvoiceForm(true)} 
                  className="btn-secondary w-full justify-start text-xs rounded-xl"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Mettre à jour facturation
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* MODAL: Invoice creation Form */}
      {showInvoiceForm && (
        <div className="modal-backdrop" onClick={() => setShowInvoiceForm(false)}>
          <div className="modal animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Paramétrer la facturation</h3>
              <button onClick={() => setShowInvoiceForm(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddInvoice} className="p-6 space-y-5">
              
              <div>
                <label className="label">Assujetti aux frais</label>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      checked={invoiceForm.is_billable}
                      onChange={() => setInvoiceForm((p) => ({ ...p, is_billable: true }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    Oui, facturable
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      checked={!invoiceForm.is_billable}
                      onChange={() => setInvoiceForm((p) => ({ ...p, is_billable: false }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    Non, gratuit
                  </label>
                </div>
              </div>

              {invoiceForm.is_billable && (
                <>
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                    <p className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Choix des prestations</p>
                    
                    <div>
                      <label className="label">Sélectionner un élément du catalogue</label>
                      <select
                        onChange={(e) => {
                          const itemId = e.target.value;
                          if (!itemId) return;
                          const selectedItem = catalogItems.find(item => item.id === itemId);
                          if (selectedItem) {
                            const existing = selectedItems.find(si => si.item.id === itemId);
                            if (existing) {
                              setSelectedItems(selectedItems.map(si => si.item.id === itemId ? { ...si, quantity: si.quantity + 1 } : si));
                            } else {
                              setSelectedItems([...selectedItems, { item: selectedItem, quantity: 1 }]);
                            }
                          }
                          e.target.value = '';
                        }}
                        className="input bg-white dark:bg-slate-900"
                      >
                        <option value="">Sélectionnez un élément à ajouter...</option>
                        {catalogItems.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.price.toLocaleString('fr-FR')} XOF)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-3.5 space-y-2">
                      <label className="label font-bold text-slate-700 dark:text-slate-300">Ajouter une prestation libre (hors catalogue)</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Nom de la prestation..."
                          value={customItemName}
                          onChange={(e) => setCustomItemName(e.target.value)}
                          className="input bg-white dark:bg-slate-900 py-1.5 text-xs flex-1"
                        />
                        <input
                          type="number"
                          placeholder="Prix (XOF)"
                          value={customItemPrice || ''}
                          onChange={(e) => setCustomItemPrice(Number(e.target.value))}
                          className="input bg-white dark:bg-slate-900 py-1.5 text-xs w-32"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customItemName || customItemPrice <= 0) return;
                            const newItem = {
                              item: {
                                id: 'custom-' + Date.now(),
                                name: customItemName,
                                price: customItemPrice,
                                is_custom: true,
                              } as any,
                              quantity: 1,
                            };
                            setSelectedItems([...selectedItems, newItem]);
                            setCustomItemName('');
                            setCustomItemPrice(0);
                          }}
                          className="btn-secondary text-xs rounded-xl py-1.5 px-4 flex items-center justify-center gap-1 shrink-0"
                        >
                          <Plus className="w-4 h-4 text-primary-500" />
                          Ajouter
                        </button>
                      </div>
                    </div>

                    {selectedItems.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                        {selectedItems.map((si, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-4 p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{si.item.name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{si.item.price.toLocaleString('fr-FR')} XOF / u</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (si.quantity > 1) {
                                    setSelectedItems(selectedItems.map((s, i) => i === idx ? { ...s, quantity: s.quantity - 1 } : s));
                                  }
                                }}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold text-slate-800 dark:text-white w-6 text-center">{si.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItems(selectedItems.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s));
                                }}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItems(selectedItems.filter((_, i) => i !== idx));
                                }}
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded ml-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">Votre panier est vide. Sélectionnez un élément ci-dessus.</p>
                    )}

                    <div className="pt-3 border-t border-slate-200/40 dark:border-slate-800/40 flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-500 uppercase">Total calculé :</span>
                      <span className="text-sm font-black text-primary-600 dark:text-primary-400">
                        {selectedItems.reduce((sum, current) => sum + current.item.price * current.quantity, 0).toLocaleString('fr-FR')} XOF
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="label">Échéance de réalisation (Jours)</label>
                    <input
                      type="number"
                      value={invoiceForm.expected_duration_days}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, expected_duration_days: Number(e.target.value) }))}
                      className="input"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Service de traitement responsable</label>
                    <select
                      value={invoiceForm.responsible_service_id}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, responsible_service_id: e.target.value }))}
                      className="input"
                      required
                    >
                      <option value="">Sélectionner un service...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setShowInvoiceForm(false)} className="btn-secondary px-5 py-2.5">
                  Annuler
                </button>
                <button type="submit" className="btn-primary px-6 py-2.5">
                  Enregistrer
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Follow-up Creation Form */}
      {showFollowUpForm && (
        <div className="modal-backdrop" onClick={() => setShowFollowUpForm(false)}>
          <div className="modal animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Créer une demande de suivi</h3>
              <button onClick={() => setShowFollowUpForm(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddFollowUp} className="p-6 space-y-5">
              <div>
                <label className="label">Statut initial</label>
                <select
                  value={followUpForm.status}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, status: e.target.value }))}
                  className="input"
                >
                  <option value="pending">En attente</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminé</option>
                  <option value="blocked">Bloqué</option>
                  <option value="late">En retard</option>
                </select>
              </div>
              
              <div>
                <label className="label">Priorité</label>
                <select
                  value={followUpForm.priority}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, priority: e.target.value }))}
                  className="input"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              
              <div>
                <label className="label">Date d'échéance du traitement</label>
                <input
                  type="date"
                  value={followUpForm.due_date}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, due_date: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setShowFollowUpForm(false)} className="btn-secondary px-5 py-2.5">
                  Annuler
                </button>
                <button type="submit" className="btn-primary px-6 py-2.5">
                  Créer le suivi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Payment Form */}
      {showPaymentModal && invoice && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="modal animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Enregistrer un versement</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Saisie d'encaissement pour la caisse</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleRecordPayment} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-xs font-bold">
                <div>
                  <p className="text-slate-400 uppercase">Montant global :</p>
                  <p className="text-slate-800 dark:text-white mt-1">{Number(invoice.amount).toLocaleString('fr-FR')} XOF</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase">Reste à solder :</p>
                  <p className="text-rose-600 dark:text-rose-400 mt-1">{(Number(invoice.amount) - Number(invoice.amount_paid)).toLocaleString('fr-FR')} XOF</p>
                </div>
              </div>

              <div>
                <label className="label">Montant du versement (XOF) *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="input"
                  min="100"
                  max={Number(invoice.amount) - Number(invoice.amount_paid)}
                  step="100"
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary px-5 py-2.5">
                  Annuler
                </button>
                <button type="submit" className="btn-primary px-6 py-2.5">
                  Confirmer l'encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Print only template */}
      {invoice && (
        <div className="print-only p-8 max-w-4xl mx-auto bg-white text-black font-sans">
          <div className="flex justify-between items-start border-b-2 border-slate-300 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800">{settings.company_name}</h1>
              {settings.slogan && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{settings.slogan}</p>}
              {(settings.rccm || settings.ifu) && (
                <p className="text-xs text-slate-400 mt-2">
                  {settings.rccm ? `RCCM: ${settings.rccm}` : ''} 
                  {settings.rccm && settings.ifu ? ' | ' : ''} 
                  {settings.ifu ? `IFU: ${settings.ifu}` : ''}
                </p>
              )}
              {settings.company_address && <p className="text-xs text-slate-400">Siège Social: {settings.company_address}</p>}
              {(settings.phone || settings.email) && (
                <p className="text-xs text-slate-400">
                  {settings.phone ? `Tél: ${settings.phone}` : ''} 
                  {settings.phone && settings.email ? ' | ' : ''} 
                  {settings.email ? `Email: ${settings.email}` : ''}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                {invoice.payment_status === 'paid' ? 'Reçu de Paiement' : 'Facture de Prestation'}
              </span>
              <p className="text-sm font-mono font-bold mt-4 text-slate-700">Code: {visit.visit_code}</p>
              <p className="text-xs text-slate-400 mt-1">Date: {format(new Date(invoice.invoice_date || invoice.created_at || Date.now()), 'dd/MM/yyyy', { locale: fr })}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-400 uppercase tracking-wider mb-2">Facturé à</p>
              <p className="text-sm font-bold text-slate-800">{visit.visitor?.first_name} {visit.visitor?.last_name}</p>
              {visit.visitor?.company && <p className="font-semibold text-slate-500 mt-0.5">{visit.visitor.company}</p>}
              {visit.visitor?.phone && <p className="text-slate-400 mt-2">Tél: {visit.visitor.phone}</p>}
              {visit.visitor?.email && <p className="text-slate-400">Email: {visit.visitor.email}</p>}
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider mb-2">Détails de visite</p>
                <p className="font-semibold text-slate-700">Motif: {visit.purpose}</p>
                <p className="font-semibold text-slate-700">Service de traitement: {visit.service?.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mt-4">Arrivée: {format(new Date(visit.arrival_time), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                {visit.departure_time && <p className="text-[10px] text-slate-400">Départ: {format(new Date(visit.departure_time), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>}
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs mb-8">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 pr-4">Description Prestation</th>
                <th className="py-3 px-4 text-right">Prix Unitaire</th>
                <th className="py-3 px-4 text-center">Quantité</th>
                <th className="py-3 pl-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.length > 0 ? (
                selectedItems.map((si, idx) => (
                  <tr key={idx} className="border-b border-slate-100 text-slate-700 font-medium">
                    <td className="py-3 pr-4 font-bold">{si.item?.name || 'Prestation'}</td>
                    <td className="py-3 px-4 text-right">{(si.item?.price || 0).toLocaleString('fr-FR')} XOF</td>
                    <td className="py-3 px-4 text-center">{si.quantity}</td>
                    <td className="py-3 pl-4 text-right font-bold">{((si.item?.price || 0) * si.quantity).toLocaleString('fr-FR')} XOF</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-100 text-slate-700 font-medium">
                  <td className="py-3 pr-4 font-bold">Frais de Prestation Générale</td>
                  <td className="py-3 px-4 text-right">{Number(invoice.amount).toLocaleString('fr-FR')} XOF</td>
                  <td className="py-3 px-4 text-center">1</td>
                  <td className="py-3 pl-4 text-right font-bold">{Number(invoice.amount).toLocaleString('fr-FR')} XOF</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-64 space-y-2.5 text-xs">
              <div className="flex justify-between font-semibold text-slate-500">
                <span>Montant Global:</span>
                <span className="text-slate-800">{Number(invoice.amount).toLocaleString('fr-FR')} XOF</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-600">
                <span>Montant Versé:</span>
                <span>{Number(invoice.amount_paid).toLocaleString('fr-FR')} XOF</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between font-black text-sm text-slate-800">
                <span>Reste à payer:</span>
                <span className={Number(invoice.amount) - Number(invoice.amount_paid) > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid)).toLocaleString('fr-FR')} XOF
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 text-center text-xs mt-16">
            <div className="border-t border-slate-300 pt-6">
              <p className="font-bold text-slate-400 uppercase tracking-wider mb-12">Le Client</p>
              <p className="italic text-slate-300">Bon pour accord & signature</p>
            </div>
            <div className="border-t border-slate-300 pt-6">
              <p className="font-bold text-slate-400 uppercase tracking-wider mb-12">La Caisse {settings.company_name}</p>
              <p className="italic text-slate-300">Cachet & Signature</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
