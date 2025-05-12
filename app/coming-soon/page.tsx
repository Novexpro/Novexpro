"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ComingSoonModal from '../../components/ComingSoonModal';

export default function ComingSoon() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = React.useState(true);

  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  const handleClose = () => {
    setIsModalOpen(false);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/95 via-blue-50/95 to-sky-50/95">
      <ComingSoonModal isOpen={isModalOpen} onClose={handleClose} />
    </div>
  );
}
