allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// NOTE: this must run BEFORE the evaluationDependsOn(":app") block below.
// Registering here means our afterEvaluate callback fires for every plugin
// subproject AFTER its build.gradle body (which may hardcode an old
// compileSdk, e.g. razorpay_flutter pins 34) but BEFORE AGP's own internal
// afterEvaluate reads compileSdk to configure the project.
subprojects {
    afterEvaluate {
        val android = extensions.findByName("android")
        if (android != null) {
            (android as? com.android.build.api.dsl.CommonExtension)
                ?.let { it.compileSdk = 36 }
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
