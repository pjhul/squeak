import { supabaseClient, supabaseServerClient } from '@supabase/supabase-auth-helpers/nextjs'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Avatar from '../../components/Avatar'
import EditQuestionModal from '../../components/EditQuestionModal'
import Surface from '../../components/Surface'
import AdminLayout from '../../layout/AdminLayout'
import dateToDays from '../../util/dateToDays'
import dayFormat from '../../util/dayFormat'
import getActiveOrganization from '../../util/getActiveOrganization'
import withAdminAccess from '../../util/withAdminAccess'

const getQuestion = async (id) => {
    const { data: question } = await supabaseClient
        .from('squeak_messages')
        .select('subject, id, slug, created_at, published, resolved')
        .eq('id', id)
        .single()
    return supabaseClient
        .from('squeak_replies')
        .select(
            `
                id,
                created_at,
                body,
                squeak_profiles!replies_profile_id_fkey (
                    first_name, last_name, avatar
                )
                `
        )
        .eq('message_id', question?.id)
        .order('created_at')
        .then((data) => ({
            question: question,
            replies: data.data,
        }))
}

const DeleteButton = ({ id, setDeleted, confirmDelete, setConfirmDelete }) => {
    const handleClick = async (e) => {
        e.stopPropagation()
        if (confirmDelete) {
            await supabaseClient.from('squeak_replies').delete().match({ id })
            setDeleted(true)
        } else {
            setConfirmDelete(true)
        }
    }
    return (
        <button onClick={handleClick} className="text-red font-bold">
            {confirmDelete ? 'Click again to confirm' : 'Delete'}
        </button>
    )
}

const Reply = ({ squeak_profiles, body, created_at, id, hideDelete }) => {
    const [deleted, setDeleted] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const handleSurfaceClick = () => {
        setConfirmDelete(false)
    }
    return (
        !deleted && (
            <Surface onClick={handleSurfaceClick}>
                <div className={`rounded-md w-full transition-opacity`}>
                    <div
                        className={`flex space-x-4 items-start transition-opacity ${confirmDelete ? 'opacity-40' : ''}`}
                    >
                        <Avatar className="flex-shrink-0" image={squeak_profiles?.avatar} />
                        <div className="flex-grow min-w-0">
                            <p className="m-0 font-semibold">
                                <span>{squeak_profiles?.first_name || 'Anonymous'}</span>
                                <span className={`ml-2 opacity-30 font-bold`}>{dayFormat(dateToDays(created_at))}</span>
                            </p>
                            <div className="bg-gray-100 p-5 rounded-md overflow-auto my-3 w-full">
                                <ReactMarkdown>{body}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                    {!hideDelete && (
                        <p className="text-right m-0">
                            <DeleteButton
                                confirmDelete={confirmDelete}
                                setConfirmDelete={setConfirmDelete}
                                setDeleted={setDeleted}
                                id={id}
                            />
                        </p>
                    )}
                </div>
            </Surface>
        )
    )
}

const Question = (props) => {
    const [question, setQuestion] = useState(props.question)
    const {
        replies,
        question: { slug, subject, id, published, resolved },
    } = question
    const { domain } = props
    const [modalOpen, setModalOpen] = useState(false)
    const handleModalSubmit = async () => {
        const updatedQuestion = await getQuestion(id)
        setQuestion(updatedQuestion)
        setModalOpen(false)
    }

    return (
        <>
            <h1 className="m-0">{subject}</h1>
            <ul className="flex items-center space-x-2">
                {question.question.slug?.map((slug) => {
                    const url = domain ? new URL(domain).origin : ''
                    const questionLink = url + slug.trim()

                    return (
                        <li key={questionLink}>
                            <span className="text-[14px] opacity-50 text-inherit">Appears on: </span>
                            <a
                                href={url}
                                target="_blank"
                                className="text-[14px] opacity-50 text-inherit"
                                rel="noreferrer"
                            >
                                {questionLink}
                            </a>
                        </li>
                    )
                })}
            </ul>
            <div className="grid gap-4 lg:grid-cols-[1fr_minmax(200px,_300px)]">
                <div className="flex space-x-9 items-start lg:mr-8 xl:mr-16">
                    <div className="flex-grow max-w-[700px]">
                        <div className="">
                            <Reply hideDelete {...replies[0]} />
                        </div>
                        <div className="grid gap-y-4">
                            {replies.slice(1).map((reply) => {
                                return <Reply key={reply.id} {...reply} />
                            })}
                        </div>
                    </div>
                </div>
                <div className='mt-12 lg:mt-0 max-w-sm'>
                    <h3 className="font-bold mb-4 text-xl">Thread options</h3>
                    <EditQuestionModal
                        values={{ subject, slug, id, published, resolved }}
                        onClose={() => setModalOpen(false)}
                        onSubmit={handleModalSubmit}
                    />
                </div>
            </div>
        </>
    )
}

Question.getLayout = function getLayout(page) {
    const title = page?.props?.question?.question?.subject || 'Question'
    return (
        <AdminLayout title={title} hideTitle={true} contentStyle={{  }}>
            {page}
        </AdminLayout>
    )
}

export const getServerSideProps = withAdminAccess({
    redirectTo: '/login',
    async getServerSideProps(context) {
        const { id } = context.query
        const organizationId = await getActiveOrganization(context)
        const question = await getQuestion(id)

        const {
            data: { company_domain },
        } = await supabaseServerClient(context)
            .from('squeak_config')
            .select('company_domain')
            .eq('organization_id', organizationId)
            .single()

        return {
            props: { question, domain: company_domain },
        }
    },
})

export default Question
