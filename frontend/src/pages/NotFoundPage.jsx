import { Compass, Home } from 'lucide-react';
import { useBreadcrumbs } from '../context/BreadcrumbContext.jsx';
import { Card } from '../components/ui/Layout.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';

export default function NotFoundPage() {
  useBreadcrumbs([{ label: 'Page not found' }]);
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or you do not have access to it."
        action={
          <ButtonLink to="/" icon={Home}>
            Back to dashboard
          </ButtonLink>
        }
      />
    </Card>
  );
}
