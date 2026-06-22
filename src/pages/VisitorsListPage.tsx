import { useEffect, useState } from 'react';
import { supabase, Visitor } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Search,
  User,
  Phone,
  Mail,
  Calendar,
  Users,
  Trash2,
} from 'lucide-react';

export default function VisitorsListPage() {
  const { profile } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    fetchVisitors();
  }, [searchQuery, typeFilter]);

  const fetchVisitors = async () => {
    setLoading(true);
    let query = supabase.from('visitors').select('*').order('last_name', { ascending: true });

    if (typeFilter) {
      query = query.eq('visitor_type', typeFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      // Client-side search
      const filtered = searchQuery
        ? data.filter(
            (v) =>
              v.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.email?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : data;
      setVisitors(filtered);
    }
    setLoading(false);
  };

  const handleDeleteVisitor = async (visitor: Visitor) => {
    if (window.confirm(`Voulez-vous vraiment supprimer définitivement le visiteur "${visitor.first_name} ${visitor.last_name}" ?`)) {
      const { error } = await supabase
        .from('visitors')
        .delete()
        .eq('id', visitor.id);

      if (error) {
        alert(`Erreur lors de la suppression : ${error.message}`);
      } else {
        fetchVisitors();
      }
    }
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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      client: 'bg-emerald-100 text-emerald-800',
      prospect: 'bg-blue-100 text-blue-800',
      supplier: 'bg-amber-100 text-amber-800',
      partner: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repertoire des visiteurs</h1>
          <p className="text-gray-500">Liste de tous les visiteurs enregistres</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, entreprise, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">Tous les types</option>
            <option value="client">Clients</option>
            <option value="prospect">Prospects</option>
            <option value="supplier">Fournisseurs</option>
            <option value="partner">Partenaires</option>
            <option value="other">Autres</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-gray-600">{visitors.length} visiteur(s) trouve(s)</p>

      {/* Visitors Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : visitors.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun visiteur trouve</h3>
          <p className="text-gray-500">Les visiteurs seront ajoutes automatiquement lors de l'enregistrement de visites</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visitors.map((visitor) => (
            <div key={visitor.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-primary-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {visitor.first_name} {visitor.last_name}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">{visitor.company || 'Particulier'}</p>
                  <span className={`badge mt-2 ${getTypeColor(visitor.visitor_type)}`}>
                    {getVisitorTypeLabel(visitor.visitor_type)}
                  </span>
                </div>
                {profile && ['admin', 'director'].includes(profile.role) && (
                  <button
                    onClick={() => handleDeleteVisitor(visitor)}
                    className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                    title="Supprimer le visiteur"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {visitor.phone && (
                  <a href={`tel:${visitor.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-700">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {visitor.phone}
                  </a>
                )}
                {visitor.email && (
                  <a href={`mailto:${visitor.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-700 truncate">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{visitor.email}</span>
                  </a>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Premier enregistrement: {format(new Date(visitor.created_at), 'dd/MM/yyyy', { locale: fr })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
