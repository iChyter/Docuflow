package com.docuflow.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class DocuFlowBackendApplication

fun main(args: Array<String>) {
	runApplication<DocuFlowBackendApplication>(*args)
}
