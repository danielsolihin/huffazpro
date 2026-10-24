import AuthForm from '@/components/auth/AuthForm';

export const metadata = {
  title: 'Daftar Akaun | HuffazPro',
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}