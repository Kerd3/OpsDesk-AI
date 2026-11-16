import { useLocation, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Lightbulb } from 'lucide-react';
import { ticketsApi, usersApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { PageHeader, Card } from '../components/ui/Layout.jsx';
import { Alert } from '../components/ui/States.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { TicketForm } from '../components/tickets/TicketForm.jsx';

export default function CreateTicketPage() {
  const { isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  // A draft prepared by the AI assistant arrives via router state and is only a starting point.
  const draft = location.state?.draft;
  useBreadcrumbs([{ label: 'My Tickets', to: '/my-tickets' }, { label: 'New ticket' }]);

  const { data: people } = useQuery({ queryKey: ['directory', 'all'], queryFn: () => usersApi.directory('all'), enabled: isStaff });

  const submit = async (values) => {
    const ticket = await ticketsApi.create({ ...values, source: draft ? 'ai_assist' : 'portal' }).catch((err) => {
      toast.error(err.message);
      throw err;
    });
    await queryClient.invalidateQueries({ queryKey: ['tickets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    toast.success(`Ticket ${ticket.ticketNumber} created`);
    navigate(`/tickets/${ticket.id}`, { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New support ticket" description="Tell IT what's wrong. You'll get updates here and by email." />
      {draft ? (
        <div className="mb-4">
          <Alert tone="info" icon={Sparkles} title="Draft prepared by the AI assistant">
            Review every field before submitting. Nothing is sent until you click Submit ticket.
          </Alert>
        </div>
      ) : (
        <div className="mb-4">
          <Alert
            tone="info"
            icon={Lightbulb}
            title="Try the AI assistant first"
            action={
              <ButtonLink to="/assistant" size="sm" variant="secondary" icon={Sparkles}>
                Ask AI
              </ButtonLink>
            }
          >
            Many common problems (Wi-Fi, printers, email setup) can be fixed in a few minutes with an approved help article.
          </Alert>
        </div>
      )}
      <Card>
        <TicketForm
          defaultValues={draft ? { subject: draft.subject, description: draft.description, category: draft.category, priority: draft.priority } : undefined}
          onSubmit={submit}
          onCancel={() => navigate(-1)}
          requesterOptions={isStaff && people ? people.map((p) => ({ value: p.id, label: `${p.fullName} (${p.email})` })) : undefined}
        />
      </Card>
    </div>
  );
}
