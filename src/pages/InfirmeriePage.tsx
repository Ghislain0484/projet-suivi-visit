import React, { useEffect, useState } from 'react';
import { supabase, Profile, MedicalRequest, MedicalFile, PharmacyProduct, PharmacyMovement, MedicalAppointment, MedicalExam, MedicalRest } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  HeartPulse,
  Plus,
  X,
  Save,
  CheckCircle,
  Loader2,
  Stethoscope,
  Activity,
  UserCheck,
  ClipboardList,
  Calendar,
  Pill,
  FileText,
  TrendingUp,
  UserPlus,
  Search,
  Filter,
  AlertTriangle,
  History,
  Printer,
  ChevronRight,
  ShieldAlert,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';

export default function InfirmeriePage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Rôles
  const isNurse = profile && ['nurse', 'admin'].includes(profile.role);
  const isRHOrDirector = profile && ['admin', 'director', 'accounting', 'reception'].includes(profile.role);

  // Tabs list configuration
  const getAvailableTabs = () => {
    if (isNurse) {
      return [
        { id: 'dashboard', label: 'Tableau de bord' },
        { id: 'dossiers', label: 'Dossiers' },
        { id: 'pharmacy', label: 'Pharmacie' },
        { id: 'agenda', label: 'Agenda' },
        { id: 'prescription', label: 'Ordonnances' },
        { id: 'exams', label: 'Examens' },
        { id: 'rests', label: 'Repos Médicaux' }
      ];
    }
    if (isRHOrDirector) {
      return [
        { id: 'rests', label: 'Repos Médicaux' },
        { id: 'pharmacy', label: 'Pharmacie' }
      ];
    }
    return [
      { id: 'personal', label: 'Mon Espace Santé' },
      { id: 'pharmacy', label: 'Pharmacie' }
    ];
  };

  const tabs = getAvailableTabs();
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (isNurse) return 'dashboard';
    if (isRHOrDirector) return 'rests';
    return 'personal';
  });

  // Shared / Role Metadata
  const [collaborators, setCollaborators] = useState<Profile[]>([]);

  // Nurse view state
  const [medicalFiles, setMedicalFiles] = useState<MedicalFile[]>([]);
  const [consultations, setConsultations] = useState<MedicalRequest[]>([]);
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [movements, setMovements] = useState<PharmacyMovement[]>([]);
  const [appointments, setAppointments] = useState<MedicalAppointment[]>([]);
  const [exams, setExams] = useState<MedicalExam[]>([]);
  const [rests, setRests] = useState<MedicalRest[]>([]);

  // Selection states
  const [selectedFile, setSelectedFile] = useState<MedicalFile | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<MedicalRequest | null>(null);

  // Modals & Form states
  const [showFileModal, setShowFileModal] = useState(false);
  const [fileForm, setFileForm] = useState({
    user_id: '',
    matricule: '',
    gender: 'M' as 'M' | 'F',
    birth_date: '',
    blood_group: 'O+' as any,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    department: '',
    position: '',
    allergies: '',
    vaccinations: '',
    current_treatments: '',
  });

  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [consultationForm, setConsultationForm] = useState({
    user_id: '',
    request_type: 'consultation' as 'consultation' | 'sickness' | 'rest',
    symptoms: '',
    nurse_opinion: '',
    prescription: '',
    rest_days_granted: 0,
    status: 'processed' as 'pending' | 'processed' | 'rejected',
    attachments: [] as string[],
  });

  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    reference: '',
    category: 'antalgiques' as any,
    quantity: 0,
    min_threshold: 5,
    expiration_date: '',
    supplier: '',
    location: '',
  });

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementForm, setMovementForm] = useState({
    product_id: '',
    type: 'in' as 'in' | 'out' | 'consumption' | 'adjustment',
    quantity: 0,
    notes: '',
  });

  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    user_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    purpose: 'consultation' as any,
    priority: 'normal' as any,
    notes: '',
  });

  const [showExamModal, setShowExamModal] = useState(false);
  const [examForm, setExamForm] = useState({
    user_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    exam_type: 'annual' as any,
    result: 'Aptitude confirmée',
    observations: '',
    recommendations: '',
  });

  const [showRestModal, setShowRestModal] = useState(false);
  const [restForm, setRestForm] = useState({
    employee_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    motif: '',
  });

  // Prescription Generator State
  const [prescForm, setPrescForm] = useState({
    user_id: '',
    observations: '',
    medicines: [] as { name: string; posology: string; duration: string }[],
  });
  const [newMed, setNewMed] = useState({ name: '', posology: '', duration: '' });

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMetadata();
    fetchData();
  }, [user, profile, activeTab]);

  const fetchMetadata = async () => {
    // Fetch all profiles for select lists
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    if (data) setCollaborators(data);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isNurse) {
        // Fetch all data for Nurse workspace
        const { data: files } = await supabase.from('medical_files').select('*, profile:profiles(*)');
        if (files) setMedicalFiles(files as any);

        const { data: reqs } = await supabase.from('medical_requests').select('*, profile:profiles(*)').order('created_at', { ascending: false });
        if (reqs) setConsultations(reqs as any);

        const { data: prod } = await supabase.from('pharmacy_products').select('*').order('name');
        if (prod) setProducts(prod as any);

        const { data: mov } = await supabase.from('pharmacy_movements').select('*, product:pharmacy_products(*)').order('created_at', { ascending: false });
        if (mov) setMovements(mov as any);

        const { data: appt } = await supabase.from('medical_appointments').select('*, profile:profiles(*)').order('date', { ascending: false });
        if (appt) setAppointments(appt as any);

        const { data: exm } = await supabase.from('medical_exams').select('*, profile:profiles(*)').order('date', { ascending: false });
        if (exm) setExams(exm as any);

        const { data: rst } = await supabase.from('medical_rests').select('*, profile:profiles(*)').order('created_at', { ascending: false });
        if (rst) setRests(rst as any);
      } else {
        // Fetch pharmacy products if active tab is pharmacy
        if (activeTab === 'pharmacy') {
          const { data: prod } = await supabase.from('pharmacy_products').select('*').order('name');
          if (prod) setProducts(prod as any);
        }

        if (isRHOrDirector) {
          // Fetch only restricted HR medical rests data
          const { data: rst } = await supabase.from('medical_rests').select('*, profile:profiles(*)').order('created_at', { ascending: false });
          if (rst) setRests(rst as any);
        } else if (user) {
          // Collaborator restricted view
          const { data: myFile } = await supabase.from('medical_files').select('*, profile:profiles(*)').eq('user_id', user.id).maybeSingle();
          if (myFile) setSelectedFile(myFile as any);

          const { data: reqs } = await supabase.from('medical_requests').select('*, profile:profiles(*)').eq('user_id', user.id).order('created_at', { ascending: false });
          if (reqs) setConsultations(reqs as any);

          const { data: appt } = await supabase.from('medical_appointments').select('*, profile:profiles(*)').eq('user_id', user.id).order('date', { ascending: false });
          if (appt) setAppointments(appt as any);

          const { data: exm } = await supabase.from('medical_exams').select('*, profile:profiles(*)').eq('user_id', user.id).order('date', { ascending: false });
          if (exm) setExams(exm as any);

          const { data: rst } = await supabase.from('medical_rests').select('*, profile:profiles(*)').eq('employee_id', user.id).order('created_at', { ascending: false });
          if (rst) setRests(rst as any);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Actions creation
  const handleSaveMedicalFile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('medical_files').insert(fileForm);
      if (error) throw error;
      setShowFileModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // If adding rest days, also create a medical rest slip
      let reqId = null;
      const { data: request, error } = await supabase.from('medical_requests').insert({
        user_id: consultationForm.user_id || user?.id,
        request_type: consultationForm.request_type,
        symptoms: consultationForm.symptoms,
        nurse_opinion: consultationForm.nurse_opinion,
        prescription: consultationForm.prescription,
        rest_days_granted: Number(consultationForm.rest_days_granted),
        status: consultationForm.status,
        processed_by: profile?.id,
        processed_at: new Date().toISOString(),
      }).select().single();

      if (error) throw error;
      reqId = request.id;

      if (Number(consultationForm.rest_days_granted) > 0 && consultationForm.status === 'processed') {
        const start = new Date();
        const end = new Date();
        end.setDate(start.getDate() + Number(consultationForm.rest_days_granted) - 1);
        const slipNum = `SLIP-REST-${Math.floor(1000 + Math.random() * 9000)}`;

        await supabase.from('medical_rests').insert({
          employee_id: consultationForm.user_id,
          request_id: reqId,
          slip_number: slipNum,
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
          days_count: Number(consultationForm.rest_days_granted),
          motif: consultationForm.symptoms,
          nurse_validated_by: profile?.id,
          status: 'pending',
        });
      }

      setShowConsultationModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('pharmacy_products').insert(productForm);
      if (error) throw error;
      setShowProductModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Fetch current product qty
      const { data: prod } = await supabase.from('pharmacy_products').select('quantity').eq('id', movementForm.product_id).single();
      if (!prod) throw new Error("Produit non trouvé.");

      let newQty = prod.quantity;
      if (movementForm.type === 'in') newQty += Number(movementForm.quantity);
      else if (movementForm.type === 'out' || movementForm.type === 'consumption') newQty -= Number(movementForm.quantity);
      else newQty = Number(movementForm.quantity); // adjustment directly sets quantity

      if (newQty < 0) throw new Error("Le stock disponible ne peut pas être négatif.");

      // 2. Insert movement
      const { error: movErr } = await supabase.from('pharmacy_movements').insert({
        product_id: movementForm.product_id,
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        user_id: user?.id,
        notes: movementForm.notes,
      });
      if (movErr) throw movErr;

      // 3. Update quantity
      await supabase.from('pharmacy_products').update({ quantity: newQty }).eq('id', movementForm.product_id);

      setShowMovementModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('medical_appointments').insert(appointmentForm);
      if (error) throw error;
      setShowAppointmentModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('medical_exams').insert(examForm);
      if (error) throw error;
      setShowExamModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveRest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const start = new Date(restForm.start_date);
      const end = new Date(restForm.end_date);
      const days = differenceInDays(end, start) + 1;
      if (days <= 0) throw new Error("La date de fin doit être supérieure à la date de début.");
      const slipNum = `SLIP-REST-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error } = await supabase.from('medical_rests').insert({
        employee_id: restForm.employee_id,
        slip_number: slipNum,
        start_date: restForm.start_date,
        end_date: restForm.end_date,
        days_count: days,
        motif: restForm.motif,
        nurse_validated_by: profile?.id,
        status: 'pending',
      });
      if (error) throw error;
      setShowRestModal(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRHApproval = async (restId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('medical_rests')
        .update({
          status,
          rh_validated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restId);
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Prescription medicines management
  const addMedicine = () => {
    if (!newMed.name || !newMed.posology || !newMed.duration) return;
    setPrescForm(p => ({
      ...p,
      medicines: [...p.medicines, newMed],
    }));
    setNewMed({ name: '', posology: '', duration: '' });
  };

  const removeMedicine = (index: number) => {
    setPrescForm(p => ({
      ...p,
      medicines: p.medicines.filter((_, i) => i !== index),
    }));
  };

  const handleSavePrescription = async () => {
    if (!prescForm.user_id || prescForm.medicines.length === 0) {
      alert("Veuillez sélectionner un patient et ajouter au moins un médicament.");
      return;
    }

    try {
      // Archive prescription directly inside medical requests
      const prescriptionText = prescForm.medicines.map(m => `- ${m.name} : ${m.posology} pendant ${m.duration}`).join('\n');
      const { error } = await supabase.from('medical_requests').insert({
        user_id: prescForm.user_id,
        request_type: 'consultation',
        symptoms: 'Prescription médicale générée.',
        nurse_opinion: prescForm.observations || 'Ordonnance émise.',
        prescription: prescriptionText,
        status: 'processed',
        processed_by: profile?.id,
        processed_at: new Date().toISOString(),
      });

      if (error) throw error;
      alert("Ordonnance enregistrée et archivée avec succès ! Vous pouvez maintenant l'imprimer.");
      window.print(); // Triggers the print view styled by CSS
      setPrescForm({ user_id: '', observations: '', medicines: [] });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Helper Labels & Classes
  const getCategoryLabel = (cat: string) => {
    const config = {
      antalgiques: 'Antalgiques',
      antibiotiques: 'Antibiotiques',
      antiseptiques: 'Antiseptiques',
      pansements: 'Pansements',
      premiers_secours: 'Premiers Secours',
      consommables: 'Consommables',
      autre: 'Autres produits',
    };
    return config[cat as keyof typeof config] || cat;
  };

  const getRestStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente RH', class: 'badge-warning' },
      approved: { label: 'Validé RH', class: 'badge-success' },
      rejected: { label: 'Rejeté RH', class: 'badge-danger' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  // Stats for Nurse Dashboard
  const consultationsToday = consultations.filter(c => format(new Date(c.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
  const apptsToday = appointments.filter(a => format(new Date(a.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'));
  const activeRestsCount = rests.filter(r => r.status === 'approved' && new Date(r.end_date) >= new Date() && new Date(r.start_date) <= new Date()).length;
  const productsLowStock = products.filter(p => p.quantity <= p.min_threshold);
  const productsExpired = products.filter(p => p.expiration_date && new Date(p.expiration_date) < new Date());

  // Stats for RH Dashboard
  const activeRestEmployees = rests.filter(r => r.status === 'approved' && new Date(r.end_date) >= new Date() && new Date(r.start_date) <= new Date());
  const pendingRests = rests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Printable Area - Hidden on Screen */}
      <div id="prescription-print-template" className="hidden print:block p-8 font-sans text-slate-900 bg-white">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-800">GICO SARL</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Infirmerie Médicale Interne</p>
            <p className="text-[10px] text-slate-400">Abidjan, Côte d'Ivoire | Contact: +225 27-XX-XX-XX</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Date : {format(new Date(), 'dd/MM/yyyy')}</p>
            <p className="text-[10px] text-slate-500">N° Ord : ORD-{Math.floor(1000 + Math.random() * 9000)}</p>
          </div>
        </div>

        {/* Patient Info */}
        {prescForm.user_id && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 mb-6 text-sm">
            <p className="font-bold text-xs uppercase text-slate-500 mb-1">Patient</p>
            <p className="font-extrabold text-slate-800 text-base">
              {collaborators.find(c => c.id === prescForm.user_id)?.full_name}
            </p>
            <p className="text-xs text-slate-500">
              Service : {collaborators.find(c => c.id === prescForm.user_id)?.role}
            </p>
          </div>
        )}

        {/* Prescription details */}
        <div className="space-y-4 mb-8 min-h-[300px]">
          <h2 className="text-lg font-bold border-b border-slate-200 pb-1.5 mb-3 uppercase tracking-wider text-slate-500 text-xs">Ordonnance Prescription</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2">Médicament</th>
                <th className="py-2">Posologie / Prises</th>
                <th className="py-2 text-right">Durée</th>
              </tr>
            </thead>
            <tbody>
              {prescForm.medicines.map((m, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-3 font-bold text-slate-800">{m.name}</td>
                  <td className="py-3 text-slate-600">{m.posology}</td>
                  <td className="py-3 text-right font-semibold text-slate-700">{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {prescForm.observations && (
            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 italic">
              <span className="font-bold not-italic text-slate-700">Observations :</span> {prescForm.observations}
            </div>
          )}
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-end pt-12 border-t border-slate-200">
          <div className="text-center text-xs">
            <p className="text-slate-400 font-bold">Cachet de l'établissement</p>
            <div className="w-32 h-20 border-2 border-dashed border-slate-200 rounded-2xl mt-2 flex items-center justify-center text-[10px] text-slate-300">Cachet GICO</div>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Infirmier agréé GICO</p>
            <p className="text-slate-500 text-[10px] mt-1">{profile?.full_name}</p>
            <div className="h-16 mt-2"></div>
            <p className="text-[10px] text-slate-300">Signature</p>
          </div>
        </div>
      </div>

      {/* Screen Area - Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs uppercase tracking-wider">
            <HeartPulse className="w-4 h-4" /> Infirmerie Interne GICO
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Espace Santé & Soins</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isNurse
              ? 'Workspace Infirmier : Dossiers médicaux, pharmacie, agenda clinique et validations.'
              : isRHOrDirector
                ? 'Absences et arrêts maladie du personnel.'
                : 'Consulter votre carnet médical numérique personnel.'}
          </p>
        </div>

        {/* Switch tabs for all roles */}
        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black capitalize transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Screen Area - Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64 print:hidden">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      ) : (
        <div className="print:hidden">
          {/* A. WORKSPACE INFIRMIER (Nurse / Admin) */}
          {isNurse && (
            <>
              {/* TAB 1: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-5 flex items-center justify-between border-l-4 border-rose-500">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Consultations du Jour</span>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{consultationsToday.length}</h3>
                      </div>
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl">
                        <Activity className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="card p-5 flex items-center justify-between border-l-4 border-blue-500">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Rendez-vous du Jour</span>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{apptsToday.length}</h3>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-xl">
                        <Calendar className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="card p-5 flex items-center justify-between border-l-4 border-amber-500">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Collaborateurs en Repos</span>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{activeRestsCount}</h3>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="card p-5 flex items-center justify-between border-l-4 border-rose-600">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Alertes Pharmacie</span>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                          {productsLowStock.length + productsExpired.length}
                        </h3>
                      </div>
                      <div className="p-3 bg-rose-100 dark:bg-rose-950/40 text-rose-600 rounded-xl">
                        <Pill className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* Daily workspace & Alerts */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6">
                      {/* consultations panel */}
                      <div className="card">
                        <div className="card-header bg-rose-500/5">
                          <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-5 h-5 text-rose-500" />
                            Dernières déclarations de soin et consultations
                          </h3>
                        </div>
                        <div className="card-body p-0">
                          {consultations.length === 0 ? (
                            <p className="text-sm text-slate-400 italic text-center py-8">Aucun soin déclaré.</p>
                          ) : (
                            <div className="table-container border-0 rounded-none shadow-none">
                              <table className="table text-xs">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Collaborateur</th>
                                    <th>Type</th>
                                    <th>Symptômes</th>
                                    <th>Statut</th>
                                    <th className="text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {consultations.slice(0, 5).map(c => (
                                    <tr key={c.id}>
                                      <td>{format(new Date(c.created_at), 'dd/MM/yyyy')}</td>
                                      <td className="font-bold">{c.profile?.full_name || 'N/A'}</td>
                                      <td>
                                        <span className="badge badge-primary uppercase text-[8px] font-black">
                                          {c.request_type}
                                        </span>
                                      </td>
                                      <td className="max-w-[200px] truncate">{c.symptoms}</td>
                                      <td>
                                        <span className={`badge ${c.status === 'processed' ? 'badge-success' : c.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                                          {c.status === 'processed' ? 'Traité' : c.status === 'pending' ? 'En attente' : 'Refusé'}
                                        </span>
                                      </td>
                                      <td className="text-right">
                                        <button
                                          onClick={() => {
                                            setSelectedConsultation(c);
                                            setConsultationForm({
                                              user_id: c.user_id,
                                              request_type: c.request_type,
                                              symptoms: c.symptoms,
                                              nurse_opinion: c.nurse_opinion || '',
                                              prescription: c.prescription || '',
                                              rest_days_granted: c.rest_days_granted || 0,
                                              status: c.status as any,
                                              attachments: c.attachments || [],
                                            });
                                            setShowConsultationModal(true);
                                          }}
                                          className="btn-secondary text-[9px] font-extrabold px-2.5 py-1.5 rounded-lg"
                                        >
                                          Détails
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stock & Expiration warnings */}
                    <div className="space-y-6">
                      <div className="card p-5 space-y-4">
                        <h4 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                          <AlertTriangle className="w-5 h-5 text-amber-500" /> Stock Faible / Rupture
                        </h4>
                        {productsLowStock.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Aucune alerte de stock.</p>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                            {productsLowStock.map(p => (
                              <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="font-bold">{p.name}</span>
                                <span className={`badge ${p.quantity === 0 ? 'badge-danger' : 'badge-warning'} font-mono`}>
                                  Qte: {p.quantity} (seuil: {p.min_threshold})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="card p-5 space-y-4">
                        <h4 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                          <ShieldAlert className="w-5 h-5 text-rose-500" /> Produits Périmés / Expiration
                        </h4>
                        {productsExpired.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Aucun produit périmé.</p>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                            {productsExpired.map(p => (
                              <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-rose-50/20 dark:bg-rose-950/10 rounded-xl border border-rose-500/10">
                                <span className="font-bold text-rose-700 dark:text-rose-300">{p.name}</span>
                                <span className="text-[10px] font-bold text-rose-600 font-mono">
                                  Périmé le {p.expiration_date ? format(new Date(p.expiration_date), 'dd/MM/yyyy') : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DOSSIERS MEDICAUX NUMERIQUES */}
              {activeTab === 'dossiers' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Search employee and list */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="card p-4">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Rechercher un employé..."
                          className="input pl-10"
                        />
                        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                      </div>
                    </div>

                    <div className="card p-0 overflow-hidden">
                      <div className="card-header bg-slate-50/50 flex items-center justify-between border-b">
                        <h3 className="font-bold text-xs uppercase text-slate-500">Collaborateurs</h3>
                        <button onClick={() => setShowFileModal(true)} className="btn-primary text-[10px] py-1.5 px-3.5 rounded-lg flex items-center gap-1">
                          <UserPlus className="w-3.5 h-3.5" /> Créer
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto scrollbar-thin">
                        {medicalFiles
                          .filter(f => f.profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(f => (
                            <button
                              key={f.id}
                              onClick={() => setSelectedFile(f)}
                              className={`w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-between transition-all ${
                                selectedFile?.id === f.id ? 'bg-rose-50/20 dark:bg-rose-950/10 border-l-4 border-rose-500' : ''
                              }`}
                            >
                              <div>
                                <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">
                                  {f.profile?.full_name}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-medium">Matricule : {f.matricule || 'Néant'}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Detailed Employee Dossier */}
                  <div className="lg:col-span-2">
                    {selectedFile ? (
                      <div className="card">
                        <div className="card-header bg-gradient-to-r from-rose-500/5 to-rose-600/5 border-b flex items-center justify-between">
                          <div>
                            <h3 className="font-black text-slate-800 dark:text-white text-base">
                              Dossier Médical : {selectedFile.profile?.full_name}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                              Sexe : {selectedFile.gender === 'M' ? 'Masculin' : 'Féminin'} | Groupe Sanguin :{' '}
                              <span className="font-extrabold text-rose-500">{selectedFile.blood_group || 'Inconnu'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="card-body space-y-6">
                          {/* Administrative Info */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border">
                            <div>
                              <span className="text-slate-400 font-medium block">Matricule</span>
                              <span className="font-bold text-slate-800 dark:text-white">{selectedFile.matricule || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium block">Service / Fonction</span>
                              <span className="font-bold text-slate-800 dark:text-white">
                                {selectedFile.department || '-'} / {selectedFile.position || '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium block">Contact d'urgence</span>
                              <span className="font-bold text-slate-800 dark:text-white">
                                {selectedFile.emergency_contact_name} ({selectedFile.emergency_contact_phone || '-'})
                              </span>
                            </div>
                          </div>

                          {/* Medical Background details */}
                          <div className="space-y-4 text-xs">
                            <h4 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                              <ClipboardList className="w-4 h-4 text-rose-500" /> Informations Cliniques & Antécédents
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-3 bg-red-50/20 rounded-2xl border border-red-500/10">
                                <span className="font-bold text-red-600 block mb-1">⚠️ Allergies</span>
                                <p className="text-slate-600 dark:text-slate-400">{selectedFile.allergies || 'Aucune allergie déclarée.'}</p>
                              </div>
                              <div className="p-3 bg-blue-50/20 rounded-2xl border border-blue-500/10">
                                <span className="font-bold text-blue-600 block mb-1">💉 Vaccinations</span>
                                <p className="text-slate-600 dark:text-slate-400">{selectedFile.vaccinations || 'Néant.'}</p>
                              </div>
                              <div className="p-3 bg-emerald-50/20 rounded-2xl border border-emerald-500/10">
                                <span className="font-bold text-emerald-600 block mb-1">💊 Traitements en Cours</span>
                                <p className="text-slate-600 dark:text-slate-400">{selectedFile.current_treatments || 'Aucun traitement actif.'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Historical Consultations */}
                          <div className="space-y-3 text-xs">
                            <h4 className="font-extrabold text-slate-800 dark:text-white text-xs uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                              <History className="w-4 h-4 text-rose-500" /> Historique Médical & Consultations
                            </h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                              {consultations
                                .filter(c => c.user_id === selectedFile.user_id)
                                .map(c => (
                                  <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-black uppercase text-[9px] text-rose-600">{c.request_type}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">{format(new Date(c.created_at), 'dd/MM/yyyy')}</span>
                                    </div>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">
                                      <span className="font-bold text-slate-500">Symptômes :</span> "{c.symptoms}"
                                    </p>
                                    {c.nurse_opinion && (
                                      <p className="font-medium text-slate-700 dark:text-slate-300">
                                        <span className="font-bold text-slate-500">Avis Infirmier :</span> {c.nurse_opinion}
                                      </p>
                                    )}
                                    {c.prescription && (
                                      <div className="p-2 bg-white dark:bg-slate-950 rounded-lg border text-[10px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-line">
                                        {c.prescription}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="card p-16 text-center text-slate-400">
                        <Stethoscope className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Sélectionnez un dossier médical</h3>
                        <p className="text-sm">Cliquez sur un collaborateur à gauche pour ouvrir sa fiche clinique.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* TAB 4: AGENDA MEDICAL */}
              {activeTab === 'agenda' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border">
                    <h3 className="font-bold text-xs uppercase text-slate-500">Planificateur Clinique</h3>
                    <button onClick={() => setShowAppointmentModal(true)} className="btn-primary text-xs rounded-xl">
                      Planifier un RDV Médical
                    </button>
                  </div>

                  <div className="card">
                    <div className="card-header bg-slate-50/50">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Rendez-vous programmés</h3>
                    </div>
                    <div className="card-body p-0">
                      {appointments.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-8">Aucun rendez-vous planifié.</p>
                      ) : (
                        <div className="table-container border-0 rounded-none shadow-none">
                          <table className="table text-xs">
                            <thead>
                              <tr>
                                <th>Date / Heure</th>
                                <th>Patient</th>
                                <th>Motif</th>
                                <th>Priorité</th>
                                <th>Notes / Description</th>
                                <th>Statut</th>
                                <th className="text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {appointments.map(a => (
                                <tr key={a.id}>
                                  <td className="font-bold">
                                    {format(new Date(a.date), 'dd/MM/yyyy')} à {a.time.substring(0, 5)}
                                  </td>
                                  <td className="font-bold">{a.profile?.full_name}</td>
                                  <td className="capitalize font-semibold text-rose-500">{a.purpose}</td>
                                  <td>
                                    <span className={`badge ${a.priority === 'urgent' || a.priority === 'high' ? 'badge-danger' : 'badge-gray'}`}>
                                      {a.priority}
                                    </span>
                                  </td>
                                  <td className="max-w-[200px] truncate">{a.notes || '-'}</td>
                                  <td>
                                    <span className={`badge ${a.status === 'confirmed' || a.status === 'realized' ? 'badge-success' : a.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                                      {a.status}
                                    </span>
                                  </td>
                                  <td className="text-right space-x-1">
                                    {a.status === 'scheduled' && (
                                      <>
                                        <button
                                          onClick={async () => {
                                            await supabase.from('medical_appointments').update({ status: 'confirmed' }).eq('id', a.id);
                                            fetchData();
                                          }}
                                          className="btn-success text-[8px] font-black px-2 py-1 rounded"
                                        >
                                          Confirmer
                                        </button>
                                        <button
                                          onClick={async () => {
                                            await supabase.from('medical_appointments').update({ status: 'cancelled' }).eq('id', a.id);
                                            fetchData();
                                          }}
                                          className="btn-danger text-[8px] font-black px-2 py-1 rounded"
                                        >
                                          Annuler
                                        </button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: GENERATEUR D'ORDONNANCES */}
              {activeTab === 'prescription' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Form creation */}
                  <div className="card p-6 space-y-4">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                      <Stethoscope className="w-5 h-5 text-rose-500" />
                      Rédiger une Ordonnance
                    </h3>

                    <div>
                      <label className="label">Patient *</label>
                      <select
                        value={prescForm.user_id}
                        onChange={(e) => setPrescForm(p => ({ ...p, user_id: e.target.value }))}
                        className="input"
                        required
                      >
                        <option value="">Sélectionner un collaborateur...</option>
                        {collaborators.map(c => (
                          <option key={c.id} value={c.id}>{c.full_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Add dynamic medicine list */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl space-y-3">
                      <h4 className="font-bold text-xs text-slate-600 block">Ajouter des médicaments</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={newMed.name}
                          onChange={(e) => setNewMed(p => ({ ...p, name: e.target.value }))}
                          placeholder="Nom (ex: Doliprane 1g)"
                          className="input text-xs"
                        />
                        <input
                          type="text"
                          value={newMed.posology}
                          onChange={(e) => setNewMed(p => ({ ...p, posology: e.target.value }))}
                          placeholder="Posologie (ex: 1 tab x 3/jour)"
                          className="input text-xs"
                        />
                        <input
                          type="text"
                          value={newMed.duration}
                          onChange={(e) => setNewMed(p => ({ ...p, duration: e.target.value }))}
                          placeholder="Durée (ex: 5 jours)"
                          className="input text-xs"
                        />
                      </div>
                      <button type="button" onClick={addMedicine} className="btn-secondary text-[10px] w-full py-2 rounded-xl font-extrabold">
                        + Insérer à l'ordonnance
                      </button>
                    </div>

                    <div>
                      <label className="label">Observations cliniques additionnelles</label>
                      <textarea
                        value={prescForm.observations}
                        onChange={(e) => setPrescForm(p => ({ ...p, observations: e.target.value }))}
                        className="input min-h-[80px]"
                        placeholder="Recommandations d'hygiène, repos complémentaire..."
                      />
                    </div>

                    <button
                      onClick={handleSavePrescription}
                      disabled={prescForm.medicines.length === 0 || !prescForm.user_id}
                      className="btn-primary w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4.5 h-4.5" />
                      Générer, archiver & Imprimer (A4)
                    </button>
                  </div>

                  {/* Right Column: Live visual preview */}
                  <div className="card p-6 bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/50 flex flex-col justify-between min-h-[400px] text-slate-800">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div className="space-y-0.5">
                          <h4 className="font-black text-sm tracking-tight text-slate-800 dark:text-white">GICO SARL</h4>
                          <p className="text-[9px] uppercase font-bold text-slate-400">Infirmerie Médicale Interne</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">Date : {format(new Date(), 'dd/MM/yyyy')}</span>
                      </div>

                      {prescForm.user_id && (
                        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border text-xs">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Patient</span>
                          <span className="font-extrabold">{collaborators.find(c => c.id === prescForm.user_id)?.full_name}</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block border-b pb-1">Prescription active</span>
                        {prescForm.medicines.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-4">Aucun médicament ajouté à la prescription.</p>
                        ) : (
                          <div className="space-y-2">
                            {prescForm.medicines.map((m, index) => (
                              <div key={index} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-slate-900 border rounded-xl">
                                <div>
                                  <span className="font-bold">{m.name}</span>
                                  <span className="text-[10px] text-slate-500 block">{m.posology}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{m.duration}</span>
                                  <button onClick={() => removeMedicine(index)} className="text-rose-500 hover:text-rose-600">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: EXAMENS MEDICAUX */}
              {activeTab === 'exams' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border">
                    <h3 className="font-bold text-xs uppercase text-slate-500">Carnet d'Examens Périodiques</h3>
                    <button onClick={() => setShowExamModal(true)} className="btn-primary text-xs rounded-xl">
                      Enregistrer un examen médical
                    </button>
                  </div>

                  <div className="card">
                    <div className="card-header bg-slate-50/50">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Historique des examens de santé</h3>
                    </div>
                    <div className="card-body p-0">
                      {exams.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-8">Aucun examen enregistré.</p>
                      ) : (
                        <div className="table-container border-0 rounded-none shadow-none">
                          <table className="table text-xs">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Employé</th>
                                <th>Type d'examen</th>
                                <th>Résultat</th>
                                <th>Observations</th>
                                <th>Recommandations</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exams.map(e => (
                                <tr key={e.id}>
                                  <td className="font-bold">{format(new Date(e.date), 'dd/MM/yyyy')}</td>
                                  <td className="font-bold text-slate-800 dark:text-white">{e.profile?.full_name}</td>
                                  <td>
                                    <span className="badge badge-primary uppercase text-[8px] font-black">
                                      {e.exam_type}
                                    </span>
                                  </td>
                                  <td className="font-semibold text-emerald-600">{e.result}</td>
                                  <td>{e.observations || '-'}</td>
                                  <td>{e.recommendations || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: REPOS MEDICAUX */}
              {activeTab === 'rests' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border">
                    <h3 className="font-bold text-xs uppercase text-slate-500">Registre des Repos Médicaux</h3>
                    <button onClick={() => setShowRestModal(true)} className="btn-primary text-xs rounded-xl">
                      Émettre une fiche de repos médical
                    </button>
                  </div>

                  <div className="card">
                    <div className="card-header bg-slate-50/50">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Historique des fiches émises</h3>
                    </div>
                    <div className="card-body p-0">
                      {rests.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-8">Aucun repos médical enregistré.</p>
                      ) : (
                        <div className="table-container border-0 rounded-none shadow-none">
                          <table className="table text-xs">
                            <thead>
                              <tr>
                                <th>N° Fiche</th>
                                <th>Délivré le</th>
                                <th>Employé</th>
                                <th>Date Début</th>
                                <th>Date Fin</th>
                                <th>Durée (Jours)</th>
                                <th>Motif</th>
                                <th>Validation RH</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rests.map(r => (
                                <tr key={r.id}>
                                  <td className="font-bold font-mono">{r.slip_number}</td>
                                  <td>{format(new Date(r.delivery_date), 'dd/MM/yyyy')}</td>
                                  <td className="font-bold">{r.profile?.full_name}</td>
                                  <td>{format(new Date(r.start_date), 'dd/MM/yyyy')}</td>
                                  <td>{format(new Date(r.end_date), 'dd/MM/yyyy')}</td>
                                  <td className="font-bold font-mono">{r.days_count} j</td>
                                  <td className="max-w-[200px] truncate">{r.motif}</td>
                                  <td>{getRestStatusBadge(r.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 3: PHARMACIE & STOCK (Visible to everyone) */}
          {activeTab === 'pharmacy' && (
            <div className="space-y-6">
              {/* Actions buttons */}
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border">
                <h3 className="font-bold text-xs uppercase text-slate-500">Boîte à Pharmacie GICO</h3>
                <div className="flex gap-2">
                  {isNurse ? (
                    <>
                      <button onClick={() => setShowMovementModal(true)} className="btn-secondary text-xs rounded-xl">
                        Mouvement Stock (Entrée/Sortie)
                      </button>
                      <button onClick={() => setShowProductModal(true)} className="btn-primary text-xs rounded-xl">
                        Ajouter Produit
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setAppointmentForm({
                          user_id: user?.id || '',
                          date: format(new Date(), 'yyyy-MM-dd'),
                          time: '09:00',
                          purpose: 'consultation' as any,
                          priority: 'normal' as any,
                          notes: '',
                        });
                        setShowAppointmentModal(true);
                      }}
                      className="btn-primary text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:scale-[1.02] transition-transform"
                    >
                      <Calendar className="w-4 h-4" />
                      Prendre RDV Médical
                    </button>
                  )}
                </div>
              </div>

              {/* Stock Registry */}
              <div className="card">
                <div className="card-header bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">État des stocks médicaux</h3>
                </div>
                <div className="card-body p-0">
                  {products.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">Aucun produit en stock.</p>
                  ) : (
                    <div className="table-container border-0 rounded-none shadow-none">
                      <table className="table text-xs">
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>Référence</th>
                            <th>Catégorie</th>
                            <th>Quantité</th>
                            <th>Seuil Min</th>
                            <th>Date Péremption</th>
                            <th>Localisation</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map(p => {
                            const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
                            const isLow = p.quantity <= p.min_threshold;
                            return (
                              <tr key={p.id}>
                                <td className="font-bold text-slate-800 dark:text-white">{p.name}</td>
                                <td className="font-mono">{p.reference || '-'}</td>
                                <td>{getCategoryLabel(p.category)}</td>
                                <td className="font-bold font-mono">{p.quantity}</td>
                                <td className="font-mono text-slate-400">{p.min_threshold}</td>
                                <td className={`font-mono ${isExpired ? 'text-rose-600 font-bold' : ''}`}>
                                  {p.expiration_date ? format(new Date(p.expiration_date), 'dd/MM/yyyy') : '-'}
                                </td>
                                <td>{p.location || '-'}</td>
                                <td>
                                  {isExpired ? (
                                    <span className="badge badge-danger">Périmé</span>
                                  ) : p.quantity === 0 ? (
                                    <span className="badge badge-danger">Rupture</span>
                                  ) : isLow ? (
                                    <span className="badge badge-warning">Alerte</span>
                                  ) : (
                                    <span className="badge badge-success">OK</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* B. WORKSPACE RH & DIRECTION (Confidential view - stats only) */}
          {isRHOrDirector && !isNurse && (
            <div className="space-y-6">
              {/* RH Health stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-5 flex items-center justify-between border-l-4 border-amber-500">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Collaborateurs indisponibles</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{activeRestEmployees.length}</h3>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                </div>

                <div className="card p-5 flex items-center justify-between border-l-4 border-blue-500">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Arrêts Année</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{rests.length}</h3>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-xl">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>

                <div className="card p-5 flex items-center justify-between border-l-4 border-rose-500">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Validations RH en attente</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{pendingRests.length}</h3>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl">
                    <UserCheck className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Rests management panel for RH */}
              <div className="card">
                <div className="card-header bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">
                    Suivi Administratif des Repos Médicaux & Validation Absence
                  </h3>
                </div>
                <div className="card-body p-0">
                  {rests.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">Aucun repos médical enregistré.</p>
                  ) : (
                    <div className="table-container border-0 rounded-none shadow-none">
                      <table className="table text-xs">
                        <thead>
                          <tr>
                            <th>N° Fiche</th>
                            <th>Collaborateur</th>
                            <th>Période d'arrêt</th>
                            <th>Durée</th>
                            <th>Statut RH</th>
                            <th className="text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rests.map(r => (
                            <tr key={r.id}>
                              <td className="font-bold font-mono">{r.slip_number}</td>
                              <td className="font-bold text-slate-800 dark:text-white">{r.profile?.full_name}</td>
                              <td>
                                Du {format(new Date(r.start_date), 'dd/MM/yyyy')} au {format(new Date(r.end_date), 'dd/MM/yyyy')}
                              </td>
                              <td className="font-bold">{r.days_count} jours</td>
                              <td>{getRestStatusBadge(r.status)}</td>
                              <td className="text-right space-x-1">
                                {r.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleRHApproval(r.id, 'approved')}
                                      className="btn-success text-[8px] font-black px-2.5 py-1.5 rounded-lg"
                                    >
                                      Approuver
                                    </button>
                                    <button
                                      onClick={() => handleRHApproval(r.id, 'rejected')}
                                      className="btn-danger text-[8px] font-black px-2.5 py-1.5 rounded-lg"
                                    >
                                      Rejeter
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* C. WORKSPACE COLLABORATEUR (Confidential restricted view) */}
          {!isNurse && !isRHOrDirector && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Personal medical card details */}
              <div className="lg:col-span-1 space-y-6">
                <div className="card">
                  <div className="card-header bg-rose-500/5">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                      <HeartPulse className="w-5 h-5 text-rose-500" /> Mon Dossier Santé
                    </h3>
                  </div>
                  <div className="card-body p-6 space-y-5 text-xs">
                    {selectedFile ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl">
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">Groupe Sanguin</span>
                            <span className="font-extrabold text-rose-500 text-sm">{selectedFile.blood_group || 'Inconnu'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium block">Genre / Âge</span>
                            <span className="font-bold">
                              {selectedFile.gender === 'M' ? 'Homme' : 'Femme'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="text-slate-400 block font-bold uppercase text-[9px] border-b pb-1">Allergies</span>
                          <p className="font-semibold text-rose-600">{selectedFile.allergies || 'Aucune allergie signalée.'}</p>
                        </div>

                        <div className="space-y-2">
                          <span className="text-slate-400 block font-bold uppercase text-[9px] border-b pb-1">Traitements actuels</span>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{selectedFile.current_treatments || 'Aucun.'}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-400 italic text-center py-4">Fiche médicale non initialisée. Veuillez contacter l'infirmier.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: history of requests and declarations */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border">
                  <h3 className="font-bold text-xs uppercase text-slate-500">Mes Consultations & Soins</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setAppointmentForm({
                          user_id: user?.id || '',
                          date: format(new Date(), 'yyyy-MM-dd'),
                          time: '09:00',
                          purpose: 'consultation' as any,
                          priority: 'normal' as any,
                          notes: '',
                        });
                        setShowAppointmentModal(true);
                      }}
                      className="btn-secondary text-xs rounded-xl flex items-center gap-1.5 py-2 px-4 shadow-sm hover:scale-[1.02] transition-transform"
                    >
                      <Calendar className="w-4 h-4 text-rose-500" />
                      Prendre RDV Médical
                    </button>
                    <button onClick={() => setShowConsultationModal(true)} className="btn-primary text-xs rounded-xl">
                      Déclarer un Soin / Consultation
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header bg-slate-50/50">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Historique de mes visites d'infirmerie</h3>
                  </div>
                  <div className="card-body p-4 space-y-4">
                    {consultations.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">Aucune demande enregistrée.</p>
                    ) : (
                      consultations.map(c => (
                        <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-black text-rose-500 uppercase text-[9px]">{c.request_type}</span>
                            <span className="text-[10px] text-slate-400">{format(new Date(c.created_at), 'dd/MM/yyyy')}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Symptômes : "{c.symptoms}"
                          </p>
                          {c.nurse_opinion && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                              Avis infirmier : {c.nurse_opinion}
                            </p>
                          )}
                          {c.prescription && (
                            <div className="p-3 bg-white dark:bg-slate-950 border text-[10px] font-mono text-slate-500 whitespace-pre-line rounded-xl">
                              {c.prescription}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODALS */}
      {/* ============================================================== */}

      {/* 1. File creation modal */}
      {showFileModal && (
        <div className="modal-backdrop" onClick={() => setShowFileModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-extrabold">Initialiser un Dossier Médical</h3>
              <button onClick={() => setShowFileModal(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveMedicalFile} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label">Collaborateur *</label>
                <select
                  value={fileForm.user_id}
                  onChange={(e) => setFileForm(p => ({ ...p, user_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {collaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Matricule</label>
                  <input type="text" value={fileForm.matricule} onChange={(e) => setFileForm(p => ({ ...p, matricule: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Sexe *</label>
                  <select value={fileForm.gender} onChange={(e) => setFileForm(p => ({ ...p, gender: e.target.value as any }))} className="input" required>
                    <option value="M">Masculin</option>
                    <option value="F">Féminin</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date de Naissance</label>
                  <input type="date" value={fileForm.birth_date} onChange={(e) => setFileForm(p => ({ ...p, birth_date: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Groupe Sanguin *</label>
                  <select value={fileForm.blood_group} onChange={(e) => setFileForm(p => ({ ...p, blood_group: e.target.value as any }))} className="input" required>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Allergies connues</label>
                <input type="text" value={fileForm.allergies} onChange={(e) => setFileForm(p => ({ ...p, allergies: e.target.value }))} className="input" placeholder="ex: Pénicilline, lactose..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact d'urgence *</label>
                  <input type="text" value={fileForm.emergency_contact_name} onChange={(e) => setFileForm(p => ({ ...p, emergency_contact_name: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="label">Téléphone d'urgence *</label>
                  <input type="text" value={fileForm.emergency_contact_phone} onChange={(e) => setFileForm(p => ({ ...p, emergency_contact_phone: e.target.value }))} className="input" required />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold">Enregistrer le dossier</button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Consultation creation / treatment modal */}
      {showConsultationModal && (
        <div className="modal-backdrop" onClick={() => setShowConsultationModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-extrabold">Saisie de Soin / Consultation</h3>
              <button onClick={() => setShowConsultationModal(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveConsultation} className="p-6 space-y-4 text-xs">
              {isNurse ? (
                <div>
                  <label className="label">Patient *</label>
                  <select
                    value={consultationForm.user_id}
                    onChange={(e) => setConsultationForm(p => ({ ...p, user_id: e.target.value }))}
                    className="input"
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type d'événement *</label>
                  <select value={consultationForm.request_type} onChange={(e) => setConsultationForm(p => ({ ...p, request_type: e.target.value as any }))} className="input" required>
                    <option value="consultation">Consultation Infirmerie</option>
                    <option value="sickness">Signalement Maladie</option>
                    <option value="rest">Repos Médical</option>
                  </select>
                </div>
                {isNurse && (
                  <div>
                    <label className="label">Statut *</label>
                    <select value={consultationForm.status} onChange={(e) => setConsultationForm(p => ({ ...p, status: e.target.value as any }))} className="input" required>
                      <option value="pending">En attente</option>
                      <option value="processed">Traité / Autorisé</option>
                      <option value="rejected">Rejeté</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Symptômes / Motifs de consultation *</label>
                <textarea
                  value={consultationForm.symptoms}
                  onChange={(e) => setConsultationForm(p => ({ ...p, symptoms: e.target.value }))}
                  className="input min-h-[80px]"
                  required
                />
              </div>

              {isNurse && (
                <>
                  <div>
                    <label className="label">Diagnostic / Notes Infirmier</label>
                    <textarea
                      value={consultationForm.nurse_opinion}
                      onChange={(e) => setConsultationForm(p => ({ ...p, nurse_opinion: e.target.value }))}
                      className="input min-h-[60px]"
                    />
                  </div>
                  <div>
                    <label className="label">Prescription de traitement</label>
                    <textarea
                      value={consultationForm.prescription}
                      onChange={(e) => setConsultationForm(p => ({ ...p, prescription: e.target.value }))}
                      className="input min-h-[60px]"
                      placeholder="Médicaments prescrits..."
                    />
                  </div>
                  <div>
                    <label className="label">Jours d'arrêt de travail prescrits</label>
                    <input
                      type="number"
                      value={consultationForm.rest_days_granted}
                      onChange={(e) => setConsultationForm(p => ({ ...p, rest_days_granted: Number(e.target.value) }))}
                      className="input"
                      min="0"
                      max="30"
                    />
                  </div>
                </>
              )}

              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold">Enregistrer</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Product creation modal */}
      {showProductModal && (
        <div className="modal-backdrop" onClick={() => setShowProductModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-extrabold">Ajouter un produit (Pharmacie)</h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom du Produit *</label>
                  <input type="text" value={productForm.name} onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="label">Référence unique *</label>
                  <input type="text" value={productForm.reference} onChange={(e) => setProductForm(p => ({ ...p, reference: e.target.value }))} className="input" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Catégorie *</label>
                  <select value={productForm.category} onChange={(e) => setProductForm(p => ({ ...p, category: e.target.value as any }))} className="input" required>
                    <option value="antalgiques">Antalgiques</option>
                    <option value="antibiotiques">Antibiotiques</option>
                    <option value="antiseptiques">Antiseptiques</option>
                    <option value="pansements">Pansements</option>
                    <option value="premiers_secours">Premiers Secours</option>
                    <option value="consommables">Consommables</option>
                    <option value="autre">Autres produits</option>
                  </select>
                </div>
                <div>
                  <label className="label">Seuil minimal d'alerte *</label>
                  <input type="number" value={productForm.min_threshold} onChange={(e) => setProductForm(p => ({ ...p, min_threshold: Number(e.target.value) }))} className="input" min="0" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantité initiale *</label>
                  <input type="number" value={productForm.quantity} onChange={(e) => setProductForm(p => ({ ...p, quantity: Number(e.target.value) }))} className="input" min="0" required />
                </div>
                <div>
                  <label className="label">Date d'expiration</label>
                  <input type="date" value={productForm.expiration_date} onChange={(e) => setProductForm(p => ({ ...p, expiration_date: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fournisseur</label>
                  <input type="text" value={productForm.supplier} onChange={(e) => setProductForm(p => ({ ...p, supplier: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Emplacement</label>
                  <input type="text" value={productForm.location} onChange={(e) => setProductForm(p => ({ ...p, location: e.target.value }))} className="input" placeholder="ex: Armoire A, Tiroir 3" />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold">Enregistrer le produit</button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Stock Movement modal */}
      {showMovementModal && (
        <div className="modal-backdrop" onClick={() => setShowMovementModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-extrabold">Enregistrer un mouvement de stock</h3>
              <button onClick={() => setShowMovementModal(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveMovement} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label">Produit *</label>
                <select value={movementForm.product_id} onChange={(e) => setMovementForm(p => ({ ...p, product_id: e.target.value }))} className="input" required>
                  <option value="">Sélectionner un produit...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Dispo : {p.quantity})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type de mouvement *</label>
                  <select value={movementForm.type} onChange={(e) => setMovementForm(p => ({ ...p, type: e.target.value as any }))} className="input" required>
                    <option value="in">Entrée de stock (+)</option>
                    <option value="out">Sortie de stock (-)</option>
                    <option value="consumption">Consommation médicale (-)</option>
                    <option value="adjustment">Ajustement direct (=)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Quantité *</label>
                  <input type="number" value={movementForm.quantity} onChange={(e) => setMovementForm(p => ({ ...p, quantity: Number(e.target.value) }))} className="input" min="1" required />
                </div>
              </div>
              <div>
                <label className="label">Notes / Justificatif</label>
                <textarea value={movementForm.notes} onChange={(e) => setMovementForm(p => ({ ...p, notes: e.target.value }))} className="input" placeholder="ex: Facture fournisseur, ordonnance..." />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold">Enregistrer le mouvement</button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Appointment creation modal */}
      {showAppointmentModal && (
        <div className="modal-backdrop" onClick={() => setShowAppointmentModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-extrabold">Planifier un RDV Médical</h3>
              <button onClick={() => setShowAppointmentModal(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveAppointment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label">Patient *</label>
                {isNurse ? (
                  <select value={appointmentForm.user_id} onChange={(e) => setAppointmentForm(p => ({ ...p, user_id: e.target.value }))} className="input" required>
                    <option value="">Sélectionner...</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={profile?.full_name || ''}
                    className="input bg-slate-100 dark:bg-slate-900 border-slate-200/50"
                    disabled
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" value={appointmentForm.date} onChange={(e) => setAppointmentForm(p => ({ ...p, date: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="label">Heure *</label>
                  <input type="time" value={appointmentForm.time} onChange={(e) => setAppointmentForm(p => ({ ...p, time: e.target.value }))} className="input" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Motif *</label>
                  <select value={appointmentForm.purpose} onChange={(e) => setAppointmentForm(p => ({ ...p, purpose: e.target.value as any }))} className="input" required>
                    <option value="consultation">Consultation standard</option>
                    <option value="urgence">Urgence médicale</option>
                    <option value="periodique">Visite périodique</option>
                    <option value="reprise">Contrôle de reprise</option>
                  </select>
                </div>
                <div>
                  <label className="label">Priorité *</label>
                  <select value={appointmentForm.priority} onChange={(e) => setAppointmentForm(p => ({ ...p, priority: e.target.value as any }))} className="input" required>
                    <option value="low">Faible</option>
                    <option value="normal">Normal</option>
                    <option value="high">Élevé</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description / Instructions</label>
                <textarea value={appointmentForm.notes} onChange={(e) => setAppointmentForm(p => ({ ...p, notes: e.target.value }))} className="input" placeholder="ex: Venir à jeun..." />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold">Planifier le rendez-vous</button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Medical Exam creation modal */}
      {showExamModal && (
        <div className="modal-backdrop" onClick={() => setShowExamModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-extrabold">Enregistrer un examen médical</h3>
              <button onClick={() => setShowExamModal(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveExam} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label">Patient *</label>
                <select value={examForm.user_id} onChange={(e) => setExamForm(p => ({ ...p, user_id: e.target.value }))} className="input" required>
                  <option value="">Sélectionner...</option>
                  {collaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date d'examen *</label>
                  <input type="date" value={examForm.date} onChange={(e) => setExamForm(p => ({ ...p, date: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="label">Type d'examen *</label>
                  <select value={examForm.exam_type} onChange={(e) => setExamForm(p => ({ ...p, exam_type: e.target.value as any }))} className="input" required>
                    <option value="hiring">Visite d'embauche</option>
                    <option value="annual">Visite annuelle périodique</option>
                    <option value="return">Visite de reprise</option>
                    <option value="special">Contrôle médical spécial</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Résultat clinique *</label>
                <input type="text" value={examForm.result} onChange={(e) => setExamForm(p => ({ ...p, result: e.target.value }))} className="input" placeholder="ex: Apte, Inapte temporaire..." required />
              </div>
              <div>
                <label className="label">Observations</label>
                <textarea value={examForm.observations} onChange={(e) => setExamForm(p => ({ ...p, observations: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Recommandations</label>
                <textarea value={examForm.recommendations} onChange={(e) => setExamForm(p => ({ ...p, recommendations: e.target.value }))} className="input" placeholder="ex: Lunettes de repos requises..." />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold">Enregistrer l'examen</button>
            </form>
          </div>
        </div>
      )}

      {/* 7. Rest Slip creation modal */}
      {showRestModal && (
        <div className="modal-backdrop" onClick={() => setShowRestModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-extrabold">Émettre une fiche de repos médical</h3>
              <button onClick={() => setShowRestModal(false)} className="text-slate-400 p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveRest} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label">Collaborateur *</label>
                <select value={restForm.employee_id} onChange={(e) => setRestForm(p => ({ ...p, employee_id: e.target.value }))} className="input" required>
                  <option value="">Sélectionner...</option>
                  {collaborators.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date de début *</label>
                  <input type="date" value={restForm.start_date} onChange={(e) => setRestForm(p => ({ ...p, start_date: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="label">Date de fin *</label>
                  <input type="date" value={restForm.end_date} onChange={(e) => setRestForm(p => ({ ...p, end_date: e.target.value }))} className="input" required />
                </div>
              </div>
              <div>
                <label className="label">Motif / Diagnostic d'arrêt *</label>
                <textarea value={restForm.motif} onChange={(e) => setRestForm(p => ({ ...p, motif: e.target.value }))} className="input" placeholder="ex: Grippe sévère avec fièvre, repos prescrit..." required />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold">Émettre la fiche</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
