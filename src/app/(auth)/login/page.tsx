import AuthForm from '@/components/auth/AuthForm';

export const metadata = {
  title: 'Log Masuk | HuffazPro',
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}