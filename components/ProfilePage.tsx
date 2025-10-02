import * as React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getProfile, updateProfile, initDB } from '../db';
import { ProfileData } from '../types';

// --- Icons ---
const Spinner = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const BuildingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1m-1-4h1m-1-4h1" /></svg>;
const HashtagIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>;
const PhoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>;
const LocationIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

// --- Components ---
const Toast: React.FC<{ message: string; show: boolean; onClose: () => void }> = ({ message, show, onClose }) => {
    React.useEffect(() => {
        if (show) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    return (
        <div className={`fixed top-5 right-5 transition-all duration-300 ${show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
            <div className="flex items-center bg-green-500 border-l-4 border-green-700 text-white p-4 rounded-md shadow-lg">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>{message}</span>
            </div>
        </div>
    );
};

const InputField: React.FC<{ id: string; name: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; icon: React.ReactNode; required?: boolean; type?: string; placeholder?: string }> = ({ id, name, label, value, onChange, icon, required = false, type = 'text', placeholder = '' }) => (
    <div className="relative">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="absolute inset-y-0 left-0 top-6 pl-3 flex items-center pointer-events-none">{icon}</div>
        <input
            type={type} id={id} name={name} value={value} onChange={onChange}
            className="mt-1 block w-full pl-10 p-2.5 border border-gray-300 rounded-md shadow-sm bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500"
            required={required} placeholder={placeholder}
        />
    </div>
);


const ProfilePage: React.FC = () => {
  const { t } = useLanguage();
  
  const [dbInitialized, setDbInitialized] = React.useState(false);
  const [formData, setFormData] = React.useState<Omit<ProfileData, 'id'>>({
    userName: '',
    companyName: '',
    companyICE: '',
    companyAddress: '',
    companyPhone: '',
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSuccessToast, setShowSuccessToast] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const profileData = await getProfile();
      if (profileData) {
        setFormData(profileData);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    initDB().then(success => {
      if (success) {
        setDbInitialized(true);
        loadProfile();
      }
    });
  }, [loadProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbInitialized) return;
    setIsSaving(true);
    try {
      await updateProfile(formData);
      setShowSuccessToast(true);
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <Toast message={t('profileUpdatedSuccess')} show={showSuccessToast} onClose={() => setShowSuccessToast(false)} />
      <h1 className="text-3xl font-bold mb-2 text-gray-800">{t('profilePageTitle')}</h1>
      <p className="text-gray-500 mb-6">{t('updateProfileInfo')}</p>

      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md border border-gray-200">
        {isLoading ? (
          <p>{t('loading')}...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <fieldset disabled={isSaving} className="space-y-8">
              {/* Contact Information Section */}
              <div>
                  <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">{t('contactInfo')}</h2>
                  <InputField
                      id="userName" name="userName" label={t('yourName')} value={formData.userName}
                      onChange={handleInputChange} icon={<UserIcon />} required
                  />
              </div>

              {/* Company Information Section */}
              <div>
                  <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-6">{t('companyInfoSection')}</h2>
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <InputField
                              id="companyName" name="companyName" label={t('companyName')} value={formData.companyName}
                              onChange={handleInputChange} icon={<BuildingIcon />} required
                          />
                          <InputField
                              id="companyICE" name="companyICE" label={t('companyICE')} value={formData.companyICE}
                              onChange={handleInputChange} icon={<HashtagIcon />} required
                          />
                      </div>
                      <InputField
                          id="companyPhone" name="companyPhone" label={t('companyPhone')} value={formData.companyPhone}
                          onChange={handleInputChange} icon={<PhoneIcon />} type="tel" placeholder="ex: +212 5 22 00 11 22"
                      />
                      <div className="relative">
                          <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700">{t('companyAddress')}</label>
                          <div className="absolute left-0 top-8 pl-3 flex items-center pointer-events-none"><LocationIcon /></div>
                          <textarea
                              id="companyAddress" name="companyAddress" value={formData.companyAddress} onChange={handleInputChange}
                              rows={3} required
                              className="mt-1 block w-full pl-10 p-2.5 border border-gray-300 rounded-md shadow-sm bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                      </div>
                  </div>
              </div>
            </fieldset>

            <div className="flex items-center justify-end pt-6 mt-6 border-t border-gray-200">
                <button
                    type="submit"
                    disabled={isSaving || !dbInitialized}
                    className="w-full sm:w-auto flex justify-center items-center px-6 py-2.5 text-sm font-medium text-center text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                    {isSaving ? <Spinner /> : t('saveProfile')}
                </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;