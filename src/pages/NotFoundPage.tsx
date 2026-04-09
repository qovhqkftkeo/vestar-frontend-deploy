import { useNavigate } from 'react-router'
import completeVoteIcon from '../assets/complete_vote.svg'
import { useLanguage } from '../providers/LanguageProvider'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#F7F8FA] px-8 text-center">
      <img src={completeVoteIcon} alt="" className="w-14 h-14 mb-4 opacity-65" />
      <div className="text-[11px] font-bold text-[#7140FF] tracking-[1.4px] uppercase font-mono mb-2">
        404
      </div>
      <h1 className="text-[22px] font-semibold text-[#090A0B] mb-2 leading-tight">
        {t('nf_title')}
      </h1>
      <p className="text-[13px] text-[#707070] mb-8">{t('nf_sub')}</p>
      <button
        type="button"
        onClick={() => navigate('/vote')}
        className="bg-[#7140FF] text-white rounded-2xl px-8 py-3.5 text-[15px] font-bold hover:opacity-85 transition-opacity active:scale-[0.99]"
      >
        {t('nf_btn')}
      </button>
    </div>
  )
}
