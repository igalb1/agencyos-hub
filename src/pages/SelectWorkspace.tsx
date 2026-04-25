import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, ChevronLeft, LogOut, Check } from 'lucide-react';

export default function SelectWorkspace() {
  const { organizations, organization, switchOrganization, signOut, loading } = useAuth();
  const { lang } = useApp();
  const navigate = useNavigate();
  const isRtl = lang === 'he';

  const handleSelect = async (orgId: string) => {
    await switchOrganization(orgId);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isRtl ? 'בחר סביבת עבודה' : 'Select a workspace'}
          </h1>
          <p className="text-muted-foreground">
            {isRtl ? 'בחר את סביבת העבודה אליה תרצה להיכנס' : 'Choose which workspace you want to enter'}
          </p>
        </div>

        {organizations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {isRtl ? 'אין לך סביבות עבודה זמינות.' : 'You have no workspaces yet.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {organizations.map((org) => {
              const isActive = org.id === organization?.id;
              return (
                <Card
                  key={org.id}
                  onClick={() => handleSelect(org.id)}
                  className="cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="w-12 h-12 rounded-lg">
                      {org.logo_url && <AvatarImage src={org.logo_url} alt={org.name} />}
                      <AvatarFallback className="rounded-lg bg-primary/15 text-primary font-bold">
                        {org.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{org.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{org.role}</div>
                    </div>
                    {isActive && <Check className="w-5 h-5 text-primary" />}
                    <ChevronLeft className={`w-5 h-5 text-muted-foreground ${isRtl ? '' : 'rotate-180'}`} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="w-4 h-4" />
            {isRtl ? 'התנתק' : 'Sign out'}
          </Button>
        </div>
      </div>
    </div>
  );
}