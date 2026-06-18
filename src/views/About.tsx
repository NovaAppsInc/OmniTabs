interface AboutProps {
    className?: string;
} 

const About = ({className}: AboutProps) => {

    return (
        <div className={"flex flex-col items-center justify-center size-full p-2" + " " + className}>
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <h1>About</h1>
                <p>This is the About page of OmniTabs. Here you can find information about the application.</p>
            </div>
        </div>
    )
}

export default About